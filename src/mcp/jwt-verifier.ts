import { jwtVerify, type JWTVerifyGetKey } from "jose";
import type { ConnectionVerifier } from "./contracts.js";
import { policy, unavailable } from "./contracts.js";

/** RFC 9068 JWT access-token adapter. The AS/session adapter and pinned JWKS are explicit dependencies. */
export function createJwtConnectionVerifier(options: {
  issuer: string; resource: string; key: JWTVerifyGetKey;
  isSessionActive(input: { sessionId: string; subject: string; clientId: string }): Promise<boolean>;
  now?: () => number;
}): ConnectionVerifier {
  const now = options.now ?? Date.now;
  return { async verify(token) {
    try {
      const {payload} = await jwtVerify(token, options.key, {
        issuer: options.issuer, audience: options.resource, typ: "at+jwt", algorithms: ["RS256", "ES256"],
        requiredClaims: ["iss", "aud", "sub", "iat", "exp", "jti", "client_id", "scope"], currentDate: new Date(now()),
      });
      // This adapter deliberately accepts a single exact resource, not audience wildcards or ID tokens.
      if (payload.aud !== options.resource || typeof payload.sub !== "string" || !payload.sub || typeof payload.jti !== "string" || !payload.jti ||
          typeof payload.client_id !== "string" || !payload.client_id || typeof payload.scope !== "string" ||
          !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp! <= payload.iat! ||
          (payload.exp! - payload.iat!) * 1000 > policy.connectionMs || payload.iat! * 1000 > now()) throw unavailable();
      const identity = { sessionId: payload.jti, subject: payload.sub, clientId: payload.client_id };
      if (!await options.isSessionActive(identity)) throw unavailable();
      return { issuer: options.issuer, resource: options.resource, ...identity, issuedAt: payload.iat! * 1000,
        expiresAt: payload.exp! * 1000, scopes: payload.scope.split(" ").filter(Boolean) };
    } catch { throw unavailable(); }
  } };
}
