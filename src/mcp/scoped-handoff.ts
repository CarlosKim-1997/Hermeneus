import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { jcs } from "../portable/jcs.js";
import { matchesAuthorizedPacket, receiverSubmissionSchema } from "../portable/receiver-packet.js";
import { unavailableVerdict } from "../receiver/external/verifier.js";
import { policy, scopes, unavailable, type ConnectionVerifier, type Grant, type MetadataStore, type ParentPort } from "./contracts.js";

export const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const random = () => randomBytes(32).toString("base64url");
const ticketSchema = z.object({ purpose: z.literal("hermeneus.widget-inspection/v0"), target: z.string(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/), contextRef: z.string(), connectionHash: z.string(), capabilityId: z.string(),
  publicationRef: z.string(), packetDigest: z.string(), submissionDigest: z.string(), issuedAt: z.number().int(), expiresAt: z.number().int(),
}).strict();
export type ScopedService = ReturnType<typeof createScopedHandoff>;

/** Non-mounted library. Caller must supply a real OAuth verifier for any deployment. */
export function createScopedHandoff(options: {
  issuer: string; resource: string; webOrigin?: string; signingKey: Uint8Array; verifier: ConnectionVerifier;
  parents: ParentPort; store: MetadataStore; now?: () => number;
}) {
  const { issuer, resource, verifier, parents, store } = options;
  const origin = options.webOrigin ?? new URL(resource).origin;
  if (new URL(resource).protocol !== "https:" || new URL(issuer).protocol !== "https:" ||
      new URL(resource).search || new URL(resource).hash || new URL(origin).protocol !== "https:" ||
      new URL(origin).origin !== origin || options.signingKey.byteLength < 32) throw unavailable();
  const key = Buffer.from(options.signingKey), now = options.now ?? Date.now;
  async function authenticate(token: string, required: readonly string[] = [scopes.read]) {
    if (typeof token !== "string" || !token || token.length > 8192 || /\s/u.test(token)) throw unavailable();
    let c;
    try { c = await verifier.verify(token); } catch { throw unavailable(); }
    if (!c || c.issuer !== issuer || c.resource !== resource || !c.subject || !c.clientId || !c.sessionId ||
        !Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt) || c.issuedAt > now() || c.expiresAt <= now() ||
        c.expiresAt <= c.issuedAt || c.expiresAt - c.issuedAt > policy.connectionMs ||
        !Array.isArray(c.scopes) || !required.every(s => c.scopes.includes(s))) throw unavailable();
    // A reissued/extended token cannot silently inherit an older delegation.
    return { connectionHash: hash(jcs([c.issuer, c.resource, c.clientId, c.subject, c.sessionId, c.issuedAt, c.expiresAt])), expiresAt: c.expiresAt };
  }
  function validateGrant(g: Grant | undefined, connectionHash: string) {
    if (!g || g.revoked || g.expiresAt <= now() || g.connectionHash !== connectionHash) throw unavailable();
    return g;
  }
  async function active(token: string, ref: string, required: readonly string[]) {
    const c = await authenticate(token, required);
    const g = validateGrant(await store.getGrant(ref), c.connectionHash);
    const parent = await parents.byId(g.capabilityId);
    const after = await authenticate(token, required);
    const latest = validateGrant(await store.getGrant(ref), after.connectionHash);
    if (!parent || parent.capabilityId !== latest.capabilityId || latest.publicationRef !== parent.packet.publicationRef ||
        latest.packetDigest !== parent.packet.canonicalDigest || after.connectionHash !== c.connectionHash) {
      if (!parent) await store.deleteParent(g.capabilityId);
      throw unavailable();
    }
    return { grant: latest, packet: parent.packet, connection: after };
  }
  const sign = (claims: unknown) => {
    const payload = Buffer.from(jcs(claims), "utf8").toString("base64url");
    return payload + "." + createHmac("sha256", key).update(payload).digest("base64url");
  };
  function readTicket(value: string) {
    try {
      if (typeof value !== "string" || value.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw unavailable();
      const [payload, mac] = value.split(".");
      const expected = createHmac("sha256", key).update(payload!).digest(), observed = Buffer.from(mac!, "base64url");
      if (observed.length !== expected.length || !timingSafeEqual(observed, expected)) throw unavailable();
      const parsed = ticketSchema.parse(JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")));
      if (parsed.target !== resource || parsed.issuedAt > now() || parsed.expiresAt <= now() ||
          parsed.expiresAt - parsed.issuedAt > policy.ticketMs || parsed.expiresAt <= parsed.issuedAt) throw unavailable();
      return parsed;
    } catch { throw unavailable(); }
  }
  return {
    identity: Object.freeze({ issuer, resource, webOrigin: origin }),
    authenticate,
    /** Web-only: caller puts cookieSecret in an HttpOnly Secure SameSite cookie, not a URL/tool argument. */
    async createBrowserBinding(token: string, rawShareBearer: string) {
      const c = await authenticate(token, [scopes.read, scopes.review]);
      const parent = await parents.byBearer(rawShareBearer);
      const after = await authenticate(token, [scopes.read, scopes.review]);
      if (!parent || c.connectionHash !== after.connectionHash) throw unavailable();
      const cookieSecret = random(), csrfToken = random();
      const expiresAt = Math.min(now() + policy.ticketMs, after.expiresAt);
      await store.insertApproval({ hash: hash(jcs([cookieSecret, csrfToken, c.connectionHash, parent.capabilityId])), connectionHash: c.connectionHash, capabilityId: parent.capabilityId, expiresAt });
      return { cookieSecret, csrfToken, expiresAt, version: parent.packet.version };
    },
    /** Web-only. Neither OAuth login alone nor a model tool can mint a share delegation. */
    async delegate(token: string, rawShareBearer: string, proof: { origin: string; cookieSecret: string; csrfToken: string; confirmed: boolean }) {
      const c = await authenticate(token, [scopes.read, scopes.review]);
      if (proof.origin !== origin || proof.confirmed !== true || !/^[A-Za-z0-9_-]{43}$/.test(proof.cookieSecret) ||
          !/^[A-Za-z0-9_-]{43}$/.test(proof.csrfToken)) throw unavailable();
      const parent = await parents.byBearer(rawShareBearer);
      if (!parent || !await store.consumeApproval(hash(jcs([proof.cookieSecret, proof.csrfToken, c.connectionHash, parent.capabilityId])), c.connectionHash, now())) throw unavailable();
      const current = await parents.byId(parent.capabilityId);
      const after = await authenticate(token, [scopes.read, scopes.review]);
      if (!current || current.packet.publicationRef !== parent.packet.publicationRef || current.packet.canonicalDigest !== parent.packet.canonicalDigest ||
          c.connectionHash !== after.connectionHash) throw unavailable();
      const ref = random();
      await store.insertGrant({ ref, connectionHash: c.connectionHash, capabilityId: parent.capabilityId,
        publicationRef: current.packet.publicationRef, packetDigest: current.packet.canonicalDigest,
        createdAt: now(), expiresAt: Math.min(now() + policy.grantMs, after.expiresAt), revoked: false });
      await active(token, ref, [scopes.read, scopes.review]);
      return { contextRef: ref, version: current.packet.version };
    },
    async getPacket(token: string, ref: string) {
      return structuredClone((await active(token, ref, [scopes.read])).packet);
    },
    async prepareReview(token: string, ref: string, input: unknown) {
      const { grant, packet, connection } = await active(token, ref, [scopes.review]);
      const parsed = receiverSubmissionSchema.safeParse(input);
      if (!parsed.success || !matchesAuthorizedPacket(parsed.data, packet) || Buffer.byteLength(jcs(parsed.data), "utf8") > 85_000) throw unavailable();
      const submissionDigest = "sha256:" + hash(jcs(parsed.data));
      const nonce = random(), issuedAt = now(), expiresAt = Math.min(issuedAt + policy.ticketMs, grant.expiresAt, connection.expiresAt);
      const reviewTicket = sign({ purpose: "hermeneus.widget-inspection/v0", target: resource, nonce, contextRef: ref,
        connectionHash: connection.connectionHash, capabilityId: grant.capabilityId, publicationRef: packet.publicationRef,
        packetDigest: packet.canonicalDigest, submissionDigest, issuedAt, expiresAt });
      await store.insertTicket({ hash: hash(nonce), grantRef: ref, expiresAt });
      await active(token, ref, [scopes.review]);
      return { protocol: "hermeneus.scoped-review/v0" as const, contextRef: ref, packet: structuredClone(packet),
        submission: parsed.data, submissionDigest, reviewTicket, expiresAt };
    },
    async inspectReview(token: string, ref: string, input: unknown, ticket: string) {
      const claims = readTicket(ticket), parsed = receiverSubmissionSchema.safeParse(input);
      const { grant, packet, connection } = await active(token, ref, [scopes.review]);
      if (!parsed.success || ref !== claims.contextRef || claims.connectionHash !== connection.connectionHash ||
          grant.capabilityId !== claims.capabilityId || !matchesAuthorizedPacket(parsed.data, packet) ||
          claims.publicationRef !== packet.publicationRef || claims.packetDigest !== packet.canonicalDigest ||
          "sha256:" + hash(jcs(parsed.data)) !== claims.submissionDigest) throw unavailable();
      if (!await store.consumeTicket(hash(claims.nonce), ref, now())) throw unavailable();
      await active(token, ref, [scopes.review]); // Burn on an interrupted/invalidated response; never retry automatically.
      const cited = [...new Set(parsed.data.answerText.match(/HI-\d{3,}/g) ?? [])], known = new Set(packet.items.map(i => i.citeId));
      return { status: "STRUCTURE_ONLY", semanticProvider: "NOT_CONNECTED", submissionDigest: claims.submissionDigest,
        structureChecks: { submissionSchema: true, packetMatch: true, citationPresence: cited.length > 0, unknownCitationIds: cited.filter(id => !known.has(id)) },
        result: unavailableVerdict(packet) };
    },
    async revoke(token: string, ref: string) {
      const c = await authenticate(token);
      validateGrant(await store.getGrant(ref), c.connectionHash);
      await store.revokeGrant(ref, c.connectionHash);
    },
  };
}
