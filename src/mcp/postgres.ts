import type { Pool } from "pg";
import { buildReceiverPacket } from "../portable/receiver-packet.js";
import { PostgresReceiverReadRepository } from "../persistence/postgres/receiver-read-repository.js";
import { hashShareToken, isShareTokenFormat } from "../share/token.js";
import type { Approval, Grant, MetadataStore, ParentPort, Ticket } from "./contracts.js";

type ParentRow = { id: string; handoff_id: string; version: number };
/** Reads existing app tables; no Creator-session credential substitutes for a Share. */
export class PostgresShareParents implements ParentPort {
  private readonly reader: PostgresReceiverReadRepository;
  constructor(private readonly pool: Pool) { this.reader = new PostgresReceiverReadRepository(pool); }
  private async row(value: string, byHash: boolean) {
    const result = await this.pool.query<ParentRow>(
      `SELECT sc.id, sc.handoff_id, sc.version FROM share_capabilities sc
       JOIN handoffs h ON h.id=sc.handoff_id JOIN creators c ON c.id=h.owner_creator_id
       WHERE ${byHash ? "sc.token_hash" : "sc.id"}=$1 AND sc.revoked_at IS NULL AND c.lifecycle_status='active'`, [value]);
    return result.rows[0];
  }
  private async read(value: string, byHash: boolean) {
    const before = await this.row(value, byHash);
    if (!before) return undefined;
    const view = await this.reader.getPublishedView(before.handoff_id, before.version);
    const after = await this.row(before.id, false);
    if (!view || !after || after.handoff_id !== before.handoff_id || after.version !== before.version) return undefined;
    return { capabilityId: before.id, packet: buildReceiverPacket(view) };
  }
  byBearer(raw: string) {
    if (typeof raw !== "string" || !isShareTokenFormat(raw)) return Promise.resolve(undefined);
    return this.read(hashShareToken(raw), true);
  }
  byId(id: string) { return this.read(id, false); }
}

type GrantRow = { context_ref: string; connection_hash: string; capability_id: string; publication_ref: string;
  packet_digest: string; created_at: string; expires_at: string; revoked_at: string | null };
export class PostgresMcpMetadata implements MetadataStore {
  constructor(private readonly pool: Pool) {}
  async insertApproval(a: Approval) {
    await this.pool.query("INSERT INTO mcp_web_approvals (nonce_hash,connection_hash,capability_id,expires_at) VALUES ($1,$2,$3,$4)", [a.hash,a.connectionHash,a.capabilityId,a.expiresAt]);
  }
  async consumeApproval(hash: string, connectionHash: string, now: number) {
    const r = await this.pool.query(`UPDATE mcp_web_approvals SET consumed_at=$3
      WHERE nonce_hash=$1 AND connection_hash=$2 AND expires_at>$3 AND consumed_at IS NULL`, [hash,connectionHash,now]);
    return r.rowCount === 1;
  }
  async insertGrant(g: Grant) {
    await this.pool.query(`INSERT INTO mcp_delegations
      (context_ref,connection_hash,capability_id,publication_ref,packet_digest,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [g.ref,g.connectionHash,g.capabilityId,g.publicationRef,g.packetDigest,g.createdAt,g.expiresAt]);
  }
  async getGrant(ref: string): Promise<Grant | undefined> {
    // The final grant read also observes current parent/lifecycle in one DB snapshot.
    const r = await this.pool.query<GrantRow>(`SELECT d.* FROM mcp_delegations d
      JOIN share_capabilities sc ON sc.id=d.capability_id
      JOIN handoffs h ON h.id=sc.handoff_id JOIN creators c ON c.id=h.owner_creator_id
      WHERE d.context_ref=$1 AND sc.revoked_at IS NULL AND c.lifecycle_status='active'`, [ref]);
    const g = r.rows[0];
    return g ? { ref:g.context_ref,connectionHash:g.connection_hash,capabilityId:g.capability_id,
      publicationRef:g.publication_ref,packetDigest:g.packet_digest,createdAt:Number(g.created_at),
      expiresAt:Number(g.expires_at),revoked:g.revoked_at !== null } : undefined;
  }
  async revokeGrant(ref: string, connectionHash: string) {
    await this.pool.query("UPDATE mcp_delegations SET revoked_at=COALESCE(revoked_at,created_at) WHERE context_ref=$1 AND connection_hash=$2", [ref,connectionHash]);
  }
  async insertTicket(t: Ticket) {
    await this.pool.query("INSERT INTO mcp_widget_tickets (nonce_hash,context_ref,expires_at) VALUES ($1,$2,$3)", [t.hash,t.grantRef,t.expiresAt]);
  }
  async consumeTicket(hash: string, ref: string, now: number) {
    // One atomic UPDATE across workers. Check live parent and Creator lifecycle at consumption too.
    const r = await this.pool.query(`UPDATE mcp_widget_tickets t SET consumed_at=$3
      FROM mcp_delegations d, share_capabilities sc, handoffs h, creators c
      WHERE t.nonce_hash=$1 AND t.context_ref=$2 AND t.consumed_at IS NULL AND t.expires_at>$3
        AND d.context_ref=t.context_ref AND d.expires_at>$3 AND d.revoked_at IS NULL
        AND sc.id=d.capability_id AND sc.revoked_at IS NULL AND h.id=sc.handoff_id
        AND c.id=h.owner_creator_id AND c.lifecycle_status='active'`, [hash,ref,now]);
    return r.rowCount === 1;
  }
  async deleteParent(id: string) { await this.pool.query("DELETE FROM mcp_delegations WHERE capability_id=$1", [id]); }
  async cleanup(now: number) {
    await this.pool.query("DELETE FROM mcp_web_approvals WHERE expires_at<=$1", [now]);
    await this.pool.query("DELETE FROM mcp_widget_tickets WHERE expires_at<=$1", [now]);
    await this.pool.query("DELETE FROM mcp_delegations WHERE expires_at<=$1 OR revoked_at IS NOT NULL", [now]);
  }
}
