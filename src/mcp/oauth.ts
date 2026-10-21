import { randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, createLocalJWKSet, jwtVerify, type JWK } from "jose";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidRequestError, UnsupportedGrantTypeError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { createJwtConnectionVerifier } from "./jwt-verifier.js";
import { createScopedHandoff, hash } from "./scoped-handoff.js";
import { policy, scopes, unavailable, type MetadataStore, type ParentPort } from "./contracts.js";
import { jcs } from "../portable/jcs.js";
import { isShareTokenFormat } from '../share/token.js';

export const opaque = () => randomBytes(32).toString("base64url");
export const opaquePattern = /^[A-Za-z0-9_-]{43}$/;
export type OAuthTransaction = {
  ref: string; cookieHash: string; csrfHash: string; clientId: string; redirectUri: string;
  state: string; challenge: string; resource: string; createdAt: number; expiresAt: number;
};
export type OAuthSession = {
  id: string; subject: string; clientId: string; browserHash: string; csrfHash: string;
  issuedAt: number; expiresAt: number; connectionHash: string; revoked: boolean;
};
export type OAuthCode = {
  hash: string; sessionId: string; contextRef: string; clientId: string;
  redirectUri: string; resource: string; challenge: string; expiresAt: number;
};
/** Security metadata only. Production implementations must atomically consume transactions/codes. */
export interface OAuthStore {
  insertTransaction(t: OAuthTransaction): Promise<void>;
  consumeTransaction(ref: string, cookieHash: string, csrfHash: string, now: number): Promise<OAuthTransaction | undefined>;
  insertSession(s: OAuthSession): Promise<void>;
  getSession(id: string): Promise<OAuthSession | undefined>;
  revokeSession(id: string): Promise<void>;
  insertCode(c: OAuthCode): Promise<void>;
  getCode(hash: string, now: number): Promise<OAuthCode | undefined>;
  consumeCode(hash: string, client: string, redirect: string, resource: string, now: number): Promise<OAuthCode | undefined>;
  cleanup(now: number): Promise<void>;
}
export type PredefinedClient = { id: string; name: string; redirectUris: readonly string[] };
const bothScopes = [scopes.read, scopes.review];
const exactScopes = (s: readonly string[]) => s.length === 2 && new Set(s).size === 2 && bothScopes.every(v => s.includes(v));
function https(value: string, originOnly = false) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (originOnly && u.origin !== value)) throw unavailable();
  return u;
}
export const connectionCookie = (ref: string) => "__Host-hermeneus-mcp-" + ref;
export const transactionCookie = (ref: string) => "__Host-hermeneus-oauth-" + ref;

/** No environment fallbacks, Creator credentials, dynamic registration, refresh or live route mount. */
export async function createAnonymousOAuth(options: {
  issuer: string; resource: string; clients: readonly PredefinedClient[];
  signingKey: CryptoKey; keyId: string; publicJwk: JWK; inspectionKey: Uint8Array;
  store: OAuthStore; metadata: MetadataStore; parents: ParentPort; now?: () => number;
}) {
  const { issuer, resource, store } = options, now = options.now ?? Date.now;
  const origin = https(issuer, true).origin;
  https(resource);
  if (!options.keyId || options.publicJwk.kty !== "EC" || options.publicJwk.crv !== "P-256" || options.publicJwk.d ||
      options.publicJwk.kid !== options.keyId || options.signingKey.type !== "private") throw unavailable();
  // Whitelist public JWK fields; never echo private or supplied arbitrary fields.
  const publicJwk: JWK = { kty: "EC", crv: "P-256", x: options.publicJwk.x, y: options.publicJwk.y, kid: options.keyId, alg: "ES256", use: "sig" };
  const keys = createLocalJWKSet({ keys: [publicJwk] });
  const proof = await new SignJWT({ purpose: "local-key-pair-check" }).setProtectedHeader({ alg: "ES256", kid: options.keyId }).sign(options.signingKey);
  await jwtVerify(proof, keys, { algorithms: ["ES256"] });
  const clients = new Map<string, OAuthClientInformationFull>();
  for (const c of options.clients) {
    if (!c.id || c.id.length > 256 || clients.has(c.id) || !c.name || c.name.length > 100 || !c.redirectUris.length) throw unavailable();
    for (const raw of c.redirectUris) { const u = https(raw); if (u.href !== raw) throw unavailable(); }
    clients.set(c.id, { client_id: c.id, client_name: c.name, redirect_uris: [...c.redirectUris], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"], response_types: ["code"], scope: bothScopes.join(" ") });
  }
  async function activeSession(id: string) {
    const s = await store.getSession(id);
    if (!s || s.revoked || s.issuedAt > now() || s.expiresAt <= now() || s.expiresAt - s.issuedAt > policy.connectionMs || !clients.has(s.clientId)) throw unavailable();
    return s;
  }
  const verifier = createJwtConnectionVerifier({ issuer, resource, key: keys, now, async isSessionActive(input) {
    try { const s = await activeSession(input.sessionId); return s.subject === input.subject && s.clientId === input.clientId; } catch { return false; }
  } });
  const service = createScopedHandoff({ issuer, resource, webOrigin: origin, signingKey: options.inspectionKey, verifier,
    parents: options.parents, store: options.metadata, now });
  async function tokenFor(s: OAuthSession) {
    return new SignJWT({ client_id: s.clientId, scope: bothScopes.join(" ") })
      .setProtectedHeader({ alg: "ES256", typ: "at+jwt", kid: options.keyId })
      .setIssuer(issuer).setAudience(resource).setSubject(s.subject).setJti(s.id)
      .setIssuedAt(s.issuedAt / 1000).setExpirationTime(s.expiresAt / 1000).sign(options.signingKey);
  }
  function callback(t: Pick<OAuthTransaction, "redirectUri" | "state">, values: Record<string, string>) {
    const url = new URL(t.redirectUri); url.searchParams.set("iss", issuer); url.searchParams.set("state", t.state);
    for (const [k, v] of Object.entries(values)) url.searchParams.set(k, v);
    return url.href;
  }
  async function begin(clientId: string, p: AuthorizationParams) {
    const c = clients.get(clientId);
    if (!c || !c.redirect_uris.includes(p.redirectUri) || p.resource?.href !== resource || !exactScopes(p.scopes ?? []) ||
        !opaquePattern.test(p.codeChallenge) || !p.state || !/^[A-Za-z0-9_.~-]{16,512}$/.test(p.state)) throw new InvalidRequestError("Authorization unavailable");
    const ref = opaque(), cookie = opaque(), csrf = opaque();
    const t: OAuthTransaction = { ref, cookieHash: hash(cookie), csrfHash: hash(csrf), clientId, redirectUri: p.redirectUri,
      state: p.state, challenge: p.codeChallenge, resource, createdAt: now(), expiresAt: now() + policy.ticketMs };
    await store.insertTransaction(t);
    return { ref, cookie, csrf, clientName: c.client_name!, expiresAt: t.expiresAt };
  }
  async function approve(input: { ref: string; cookie: string; csrf: string; confirmed: boolean; shareBearer?: string }) {
    if (![input.ref, input.cookie, input.csrf].every(s => opaquePattern.test(s))) throw unavailable();
    const t = await store.consumeTransaction(input.ref, hash(input.cookie), hash(input.csrf), now());
    if (!t || !clients.get(t.clientId)?.redirect_uris.includes(t.redirectUri) || t.resource !== resource) throw unavailable();
    if (!input.confirmed) return { redirect: callback(t, { error: "access_denied" }) };
    const raw = input.shareBearer;
    if (!raw || raw.length > 512 || !await options.parents.byBearer(raw)) throw unavailable();
    const browser = opaque(), csrf = opaque(), issuedAt = Math.floor(now() / 1000) * 1000;
    const id=opaque(), subject=opaque(), expires=issuedAt+policy.connectionMs;
    const session: OAuthSession = { id, subject, clientId: t.clientId, browserHash: hash(browser), csrfHash: hash(csrf),
      issuedAt, expiresAt:expires, connectionHash:hash(jcs([issuer,resource,t.clientId,subject,id,issuedAt,expires])), revoked: false };
    await store.insertSession(session);
    try {
      const token = await tokenFor(session), b = await service.createBrowserBinding(token, raw);
      const grant = await service.delegate(token, raw, { ...b, origin, confirmed: true });
      const code = opaque(), expiresAt = Math.min(now() + policy.ticketMs, session.expiresAt);
      await store.insertCode({ hash: hash(code), sessionId: session.id, contextRef: grant.contextRef, clientId: t.clientId,
        redirectUri: t.redirectUri, resource, challenge: t.challenge, expiresAt });
      await service.getPacket(token, grant.contextRef);
      return { redirect: callback(t, { code }), contextRef: grant.contextRef, version: grant.version,
        sessionId: session.id, browser, csrf, expiresAt: session.expiresAt };
    } catch { await store.revokeSession(session.id); throw unavailable(); }
  }
  async function readCode(client: string, raw: string) {
    if (!opaquePattern.test(raw)) throw new InvalidGrantError("Grant unavailable");
    const c = await store.getCode(hash(raw), now());
    if (!c || c.clientId !== client || !clients.has(client)) throw new InvalidGrantError("Grant unavailable");
    await activeSession(c.sessionId);
    return c;
  }
  async function disconnect(id: string, cookie: string, csrf: string) {
    if (![id, cookie, csrf].every(s => opaquePattern.test(s))) throw unavailable();
    const s = await activeSession(id);
    const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(hash(a), "hex"), Buffer.from(b, "hex"));
    if (!equal(cookie, s.browserHash) || !equal(csrf, s.csrfHash)) throw unavailable();
    await store.revokeSession(id);
  }
  const provider: OAuthServerProvider = {
    clientsStore: { getClient(id) { const c = clients.get(id); return c ? structuredClone(c) : undefined; } },
    async authorize() { throw new InvalidRequestError("Use the browser approval handler"); },
    async challengeForAuthorizationCode(client, code) { return (await readCode(client.client_id, code)).challenge; },
    async exchangeAuthorizationCode(client, raw, _verifier, redirect, requestedResource): Promise<OAuthTokens> {
      const c = await readCode(client.client_id, raw);
      if (redirect !== c.redirectUri || requestedResource?.href !== resource) throw new InvalidGrantError("Grant unavailable");
      const s = await activeSession(c.sessionId), token = await tokenFor(s);
      await service.getPacket(token, c.contextRef);
      if (!await store.consumeCode(c.hash, client.client_id, redirect, resource, now())) throw new InvalidGrantError("Grant unavailable");
      await service.getPacket(token, c.contextRef);
      return { access_token: token, token_type: "Bearer", expires_in: Math.floor((s.expiresAt - now()) / 1000), scope: bothScopes.join(" ") };
    },
    async exchangeRefreshToken() { throw new UnsupportedGrantTypeError("Refresh unavailable"); },
    async verifyAccessToken(token) {
      const c = await verifier.verify(token);
      return { token, clientId: c.clientId, scopes: [...c.scopes], expiresAt: c.expiresAt / 1000, resource: new URL(resource) };
    },
    async revokeToken(client, request) {
      try { const c = await verifier.verify(request.token); if (c.clientId === client.client_id) await store.revokeSession(c.sessionId); } catch { /* RFC 7009: unknown token is a successful no-op. */ }
    },
  };
  async function previewShare(raw:string){
    if(raw.length>512||!isShareTokenFormat(raw))throw unavailable();const p=await options.parents.byBearer(raw);if(!p)throw unavailable();
    return {version:p.packet.version,publicationRef:p.packet.publicationRef,fingerprint:hash(raw),summary:p.packet.items[0]?.statement.slice(0,180)??"Published Canon"};
  }
  return { issuer, resource, origin, now, begin, approve, disconnect, callback, previewShare, provider, service, verifier, jwks: { keys: [publicJwk] } };
}
export type AnonymousOAuth = Awaited<ReturnType<typeof createAnonymousOAuth>>;
