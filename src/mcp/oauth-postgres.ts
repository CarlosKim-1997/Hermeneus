import type { Pool } from "pg";
import type { OAuthCode, OAuthSession, OAuthStore, OAuthTransaction } from "./oauth.js";
import { PostgresMcpMetadata } from "./postgres.js";
import type { Grant } from "./contracts.js";

/** Dedicated AS adapter: no source, answer, identity mapping or Creator mutations. */
export class PostgresOAuthStore implements OAuthStore {
  constructor(private readonly pool: Pool) {}
  async insertTransaction(t: OAuthTransaction) {
    await this.pool.query("INSERT INTO mcp_oauth_transactions(ref,cookie_hash,csrf_hash,client_id,redirect_uri,state,challenge,resource,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [t.ref,t.cookieHash,t.csrfHash,t.clientId,t.redirectUri,t.state,t.challenge,t.resource,t.createdAt,t.expiresAt]);
  }
  async consumeTransaction(ref: string, cookie: string, csrf: string, now: number): Promise<OAuthTransaction | undefined> {
    const r = await this.pool.query("DELETE FROM mcp_oauth_transactions WHERE ref=$1 AND cookie_hash=$2 AND csrf_hash=$3 AND expires_at>$4 RETURNING *",[ref,cookie,csrf,now]);
    const t = r.rows[0]; return t ? { ref:t.ref,cookieHash:t.cookie_hash,csrfHash:t.csrf_hash,clientId:t.client_id,redirectUri:t.redirect_uri,state:t.state,challenge:t.challenge,resource:t.resource,createdAt:Number(t.created_at),expiresAt:Number(t.expires_at) } : undefined;
  }
  async insertSession(s: OAuthSession) {
    await this.pool.query("INSERT INTO mcp_oauth_sessions(id,subject,client_id,browser_hash,csrf_hash,issued_at,expires_at,connection_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[s.id,s.subject,s.clientId,s.browserHash,s.csrfHash,s.issuedAt,s.expiresAt,s.connectionHash]);
  }
  async getSession(id: string): Promise<OAuthSession | undefined> {
    const s = (await this.pool.query("SELECT * FROM mcp_oauth_sessions WHERE id=$1",[id])).rows[0];
    return s ? { id:s.id,subject:s.subject,clientId:s.client_id,browserHash:s.browser_hash,csrfHash:s.csrf_hash,issuedAt:Number(s.issued_at),expiresAt:Number(s.expires_at),connectionHash:s.connection_hash,revoked:s.revoked_at!==null } : undefined;
  }
  async revokeSession(id: string) { await this.pool.query("UPDATE mcp_oauth_sessions SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE id=$1",[id]); }
  async insertCode(c: OAuthCode) {
    await this.pool.query("INSERT INTO mcp_oauth_codes(code_hash,session_id,context_ref,client_id,redirect_uri,resource,challenge,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[c.hash,c.sessionId,c.contextRef,c.clientId,c.redirectUri,c.resource,c.challenge,c.expiresAt]);
  }
  async getCode(hash: string, now: number): Promise<OAuthCode | undefined> {
    const c = (await this.pool.query("SELECT * FROM mcp_oauth_codes WHERE code_hash=$1 AND consumed_at IS NULL AND expires_at>$2",[hash,now])).rows[0];
    return c ? { hash:c.code_hash,sessionId:c.session_id,contextRef:c.context_ref,clientId:c.client_id,redirectUri:c.redirect_uri,resource:c.resource,challenge:c.challenge,expiresAt:Number(c.expires_at) } : undefined;
  }
  async consumeCode(hash: string, client: string, redirect: string, resource: string, now: number): Promise<OAuthCode | undefined> {
    // One winning exchange across workers; parent lifecycle is checked in this snapshot too.
    const r = await this.pool.query(`UPDATE mcp_oauth_codes c SET consumed_at=clock_timestamp()
      FROM mcp_oauth_sessions s,mcp_delegations d,share_capabilities p,handoffs h,creators o
      WHERE c.code_hash=$1 AND c.client_id=$2 AND c.redirect_uri=$3 AND c.resource=$4 AND c.expires_at>$5 AND c.consumed_at IS NULL
      AND s.id=c.session_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND s.expires_at>$5
      AND s.connection_hash=d.connection_hash
      AND d.context_ref=c.context_ref AND d.revoked_at IS NULL AND d.expires_at>$5
      AND p.id=d.capability_id AND p.revoked_at IS NULL AND h.id=p.handoff_id AND o.id=h.owner_creator_id AND o.lifecycle_status='active'
      RETURNING c.*`,[hash,client,redirect,resource,now]);
    const c = r.rows[0]; return c ? { hash:c.code_hash,sessionId:c.session_id,contextRef:c.context_ref,clientId:c.client_id,redirectUri:c.redirect_uri,resource:c.resource,challenge:c.challenge,expiresAt:Number(c.expires_at) } : undefined;
  }
  async cleanup(now: number) {
    await this.pool.query("DELETE FROM mcp_oauth_transactions WHERE expires_at<=$1",[now]);
    await this.pool.query("DELETE FROM mcp_oauth_codes WHERE expires_at<=$1 OR consumed_at IS NOT NULL",[now]);
    await this.pool.query("DELETE FROM mcp_oauth_sessions WHERE expires_at<=$1 OR revoked_at IS NOT NULL",[now]);
  }
}

/** Issuer-specific final authorization: session and parent are observed in one SQL snapshot. */
export class PostgresOAuthMcpMetadata extends PostgresMcpMetadata {
  constructor(private readonly authPool: Pool, private readonly now:()=>number=Date.now) { super(authPool); }
  override async getGrant(ref:string):Promise<Grant|undefined>{
    const r=await this.authPool.query(`SELECT d.* FROM mcp_delegations d
      JOIN mcp_oauth_sessions s ON s.connection_hash=d.connection_hash
      JOIN share_capabilities p ON p.id=d.capability_id JOIN handoffs h ON h.id=p.handoff_id JOIN creators o ON o.id=h.owner_creator_id
      WHERE d.context_ref=$1 AND s.revoked_at IS NULL AND s.issued_at<=$2 AND s.expires_at>$2
      AND d.revoked_at IS NULL AND d.expires_at>$2 AND p.revoked_at IS NULL AND o.lifecycle_status='active'`,[ref,this.now()]);
    const g=r.rows[0];return g?{ref:g.context_ref,connectionHash:g.connection_hash,capabilityId:g.capability_id,publicationRef:g.publication_ref,packetDigest:g.packet_digest,createdAt:Number(g.created_at),expiresAt:Number(g.expires_at),revoked:false}:undefined;
  }
  override async consumeTicket(hash:string,ref:string,now:number){
    const r=await this.authPool.query(`UPDATE mcp_widget_tickets t SET consumed_at=$3
      FROM mcp_delegations d,mcp_oauth_sessions s,share_capabilities p,handoffs h,creators o
      WHERE t.nonce_hash=$1 AND t.context_ref=$2 AND t.consumed_at IS NULL AND t.expires_at>$3
      AND d.context_ref=t.context_ref AND d.revoked_at IS NULL AND d.expires_at>$3
      AND s.connection_hash=d.connection_hash AND s.revoked_at IS NULL AND s.issued_at<=$3 AND s.expires_at>$3
      AND p.id=d.capability_id AND p.revoked_at IS NULL AND h.id=p.handoff_id AND o.id=h.owner_creator_id AND o.lifecycle_status='active'`,[hash,ref,now]);
    return r.rowCount===1;
  }
}
