import type { ReceiverPacket } from "../portable/receiver-packet.js";

export const policy = Object.freeze({ connectionMs: 3_600_000, grantMs: 1_800_000, ticketMs: 60_000, cleanupMs: 86_400_000 });
export const scopes = Object.freeze({ read: "handoff:read", review: "handoff:review" });
export const unavailable = () => new Error("HANDOFF_ACCESS_UNAVAILABLE");

/** Implemented by a trusted OAuth resource-server verifier, never by tool arguments. */
export type VerifiedConnection = {
  issuer: string; resource: string; subject: string; clientId: string; sessionId: string;
  issuedAt: number; expiresAt: number; scopes: readonly string[];
};
export interface ConnectionVerifier {
  verify(accessToken: string): Promise<VerifiedConnection>;
}
export type Parent = { capabilityId: string; packet: ReceiverPacket };
export interface ParentPort {
  byBearer(rawBearer: string): Promise<Parent | undefined>;
  byId(capabilityId: string): Promise<Parent | undefined>;
}
export type Grant = {
  ref: string; connectionHash: string; capabilityId: string;
  publicationRef: string; packetDigest: string; createdAt: number; expiresAt: number; revoked: boolean;
};
export type Ticket = { hash: string; grantRef: string; expiresAt: number };
export type Approval = { hash: string; connectionHash: string; capabilityId: string; expiresAt: number };
/** Stores security metadata only. It must not accept or retain answer/consent bodies. */
export interface MetadataStore {
  insertApproval(approval: Approval): Promise<void>;
  consumeApproval(hash: string, connectionHash: string, now: number): Promise<boolean>;
  insertGrant(grant: Grant): Promise<void>;
  getGrant(ref: string): Promise<Grant | undefined>;
  revokeGrant(ref: string, connectionHash: string): Promise<void>;
  insertTicket(ticket: Ticket): Promise<void>;
  consumeTicket(hash: string, grantRef: string, now: number): Promise<boolean>;
  deleteParent(capabilityId: string): Promise<void>;
  cleanup(now: number): Promise<void>;
}
