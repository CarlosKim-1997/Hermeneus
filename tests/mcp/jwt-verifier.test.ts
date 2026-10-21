import { describe,it,expect,beforeAll } from "vitest";
import { SignJWT,generateKeyPair,exportJWK,createLocalJWKSet } from "jose";
import { createJwtConnectionVerifier } from "../../src/mcp/jwt-verifier.js";
import { fixtureIssuer,fixtureResource } from "./helpers.js";
let pair:Awaited<ReturnType<typeof generateKeyPair>>,other:Awaited<ReturnType<typeof generateKeyPair>>,key:ReturnType<typeof createLocalJWKSet>;
const seconds=Math.floor(Date.now()/1000);
beforeAll(async()=>{pair=await generateKeyPair("ES256");other=await generateKeyPair("ES256");key=createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:"fixture"}]});});
async function signed(changes:Record<string,unknown>={},typ="at+jwt",wrong=false) {
  return new SignJWT({iss:fixtureIssuer,aud:fixtureResource,sub:"anonymous-fixture",jti:"session-one",client_id:"chat-client",scope:"handoff:read handoff:review",iat:seconds,exp:seconds+3600,...changes})
    .setProtectedHeader({alg:"ES256",typ,kid:"fixture"}).sign(wrong?other.privateKey:pair.privateKey);
}
describe("pinned JWT access-token verification with live session checks",()=>{
  it("validates a real signature and checks live revocation on every use",async()=>{
    let live=true;const verifier=createJwtConnectionVerifier({issuer:fixtureIssuer,resource:fixtureResource,key,isSessionActive:async()=>live,now:()=>seconds*1000});
    const token=await signed();expect((await verifier.verify(token)).sessionId).toBe("session-one");live=false;
    await expect(verifier.verify(token)).rejects.toThrow("HANDOFF_ACCESS_UNAVAILABLE");
  });
  it.each([{iss:"https://other.invalid"},{aud:"https://other.invalid"},{aud:[fixtureResource,"https://other.invalid"]},{exp:seconds},{nbf:seconds+1},{iat:seconds+1},{exp:seconds+3601},{client_id:null},{jti:null},{scope:null}])("rejects invalid claims %j",async changes=>{
    const verifier=createJwtConnectionVerifier({issuer:fixtureIssuer,resource:fixtureResource,key,isSessionActive:async()=>true,now:()=>seconds*1000});
    await expect(verifier.verify(await signed(changes))).rejects.toThrow("HANDOFF_ACCESS_UNAVAILABLE");
  });
  it("rejects wrong signing keys, ID-token type and failed session verification",async()=>{
    const verifier=createJwtConnectionVerifier({issuer:fixtureIssuer,resource:fixtureResource,key,isSessionActive:async()=>true,now:()=>seconds*1000});
    await expect(verifier.verify(await signed({},"at+jwt",true))).rejects.toThrow();await expect(verifier.verify(await signed({},"JWT"))).rejects.toThrow();
    const failed=createJwtConnectionVerifier({issuer:fixtureIssuer,resource:fixtureResource,key,isSessionActive:async()=>{throw Error("AS unavailable");},now:()=>seconds*1000});
    await expect(failed.verify(await signed())).rejects.toThrow("HANDOFF_ACCESS_UNAVAILABLE");
  });
});
