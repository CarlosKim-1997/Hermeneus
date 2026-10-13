import { describe, expect, it, vi } from "vitest";
import { promoteArtifact, checkCredential, checkPrimary, readPrimary, checkReadiness, probe, selectCommit, REPOSITORY, PROJECT, TEAM, PRIMARY, GENERATED, validateDeployment, validateRun } from "../scripts/alpha-release-gate.mjs";

const sha = "a".repeat(40);
const run = { id: 123, run_attempt: 1, repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY },
  event: "push", head_branch: "main", status: "completed", conclusion: "success", path: ".github/workflows/ci.yml", head_sha: sha };
const event = { repository: { full_name: REPOSITORY }, workflow_run: { id: 123, run_attempt: 1 } };
const jobs = ["verify", "postgres", "e2e", "dependency-audit"].map((name) => ({ name, status: "completed", conclusion: "success" }));
const project = { id: PROJECT, accountId: TEAM, ssoProtection: { deploymentType: "all" } };
const deployment = { id: "dpl_Test", url: "synthetic-stage.vercel.app", projectId: PROJECT, ownerId: TEAM,
  target: "production", readyState: "READY", meta: { hermeneusCommitSha: sha }, regions: ["icn1"], alias: [], protectionBypass: {} };

describe("synthetic Alpha release authority and readiness gate", () => {
  it.each(["ready", "empty", "queued", "drift-before", "drift-after", "redirect", "denied", "network", "timeout"])(
    "promotes exactly once and verifies the primary mapping: %s", async (mode) => {
      const calls: { url: string; options: RequestInit }[] = [];
      let reads = 0;
      const request = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options! });
        if (options?.method === "POST") {
          if (mode === "network") throw new Error("private-provider-error");
          if (mode === "empty") return new Response(null, { status: 204 });
          return Response.json({}, { status: mode === "redirect" ? 302 : mode === "denied" ? 403 : mode === "queued" ? 202 : 201 });
        }
        reads++;
        const current = mode === "drift-before" || (mode === "drift-after" && reads > 1) ? "dpl_Other" :
          reads === 1 || mode === "timeout" || (mode === "queued" && reads === 2) ? "dpl_Prior" : deployment.id;
        return Response.json({ alias: PRIMARY, projectId: PROJECT, deploymentId: current });
      });
      const wait = vi.fn(async () => {});
      const result = promoteArtifact(deployment, project, sha, "dpl_Prior", "private-fixture-api-token", request, wait);
      if (["ready", "empty", "queued"].includes(mode)) await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow();
      const posts = calls.filter((call) => call.options.method === "POST");
      expect(posts).toHaveLength(mode === "drift-before" ? 0 : 1);
      for (const call of posts) {
        expect(call.url).toBe(`https://api.vercel.com/v10/projects/${PROJECT}/promote/${deployment.id}?teamId=${TEAM}`);
        expect(call.options.body).toBe("{}");
        expect(call.options.redirect).toBe("manual");
      }
      expect(calls.every((call) => new URL(call.url).origin === "https://api.vercel.com")).toBe(true);
      expect(wait.mock.calls.length).toBeLessThanOrEqual(23);
    },
  );
  it("allows only the exact owner-approved generated alias", () => {
    expect(validateDeployment({ ...deployment, alias: [GENERATED] }, project, sha)).toBe(`https://${deployment.url}`);
    for (const alias of [[PRIMARY], [GENERATED, PRIMARY], [GENERATED, GENERATED], ["other.vercel.app"]]) {
      expect(() => validateDeployment({ ...deployment, alias }, project, sha)).toThrow();
    }
  });
  it.each(["ready", "drift", "wrong-name", "wrong-project", "redirect", "missing-deployment"])(
    "pins the primary domain mapping before and after promotion: %s", async (mode) => {
      const alias = { alias: PRIMARY, projectId: PROJECT, deploymentId: "dpl_Prior", redirect: null };
      const request = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => Response.json(
        mode === "wrong-name" ? { ...alias, alias: GENERATED } :
          mode === "wrong-project" ? { ...alias, projectId: "other" } :
            mode === "redirect" ? { ...alias, redirect: "https://evil.example" } :
              mode === "missing-deployment" ? { ...alias, deploymentId: null } :
                mode === "drift" ? { ...alias, deploymentId: "dpl_Other" } : alias,
      ));
      const result = checkPrimary("private-fixture-api-token", "dpl_Prior", request);
      if (mode === "ready") await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow();
      expect(String(request.mock.calls[0][0])).toBe(`https://api.vercel.com/v4/aliases/${PRIMARY}?teamId=${TEAM}`);
      expect(request.mock.calls[0][1]!.redirect).toBe("manual");
    },
  );
  it("rejects primary mapping drift before opening temporary readiness access", async () => {
    const responses = [run, { total_count: jobs.length, jobs }, { sha }, deployment, project,
      { alias: PRIMARY, projectId: PROJECT, deploymentId: deployment.id, redirect: null }];
    const request = vi.fn(async () => Response.json(responses.shift()));
    await expect(probe(event, "private-github-fixture", "private-vercel-fixture", `https://${deployment.url}`, "dpl_Prior", request)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(6);
  });
  it("captures the primary deployment before staging", async () => {
    expect(await readPrimary("private-fixture-api-token", async () => Response.json({ alias: PRIMARY, projectId: PROJECT, deploymentId: "dpl_Prior" }))).toBe("dpl_Prior");
  });
  it.each(["ready", "wrong-project", "wrong-team", "unprotected", "unauthorized", "redirect"])(
    "checks the credential only against the fixed protected project: %s", async (mode) => {
      const request = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => Response.json(
        mode === "wrong-project" ? { ...project, id: "other" } :
          mode === "wrong-team" ? { ...project, accountId: "other" } :
            mode === "unprotected" ? { ...project, ssoProtection: null } : project,
        { status: mode === "unauthorized" ? 401 : mode === "redirect" ? 302 : 200 },
      ));
      const result = checkCredential("private-fixture-api-token", request);
      if (mode === "ready") await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow("Alpha release gate failed");
      expect(request).toHaveBeenCalledTimes(1);
      expect(String(request.mock.calls[0][0])).toBe(`https://api.vercel.com/v9/projects/${PROJECT}?teamId=${TEAM}`);
      expect(request.mock.calls[0][1]!.redirect).toBe("manual");
    },
  );
  it("accepts the exact current main CI with every required job", () => {
    expect(validateRun(event, run, jobs, { sha })).toBe(sha);
  });
  it.each([
    { event: "pull_request" }, { head_branch: "other" }, { conclusion: "failure" }, { status: "in_progress" },
    { path: ".github/workflows/other.yml" }, { head_repository: { full_name: "fork/Hermeneus" } }, { run_attempt: 2 },
  ])("rejects unauthorized or obsolete CI %j", (change) => {
    expect(() => validateRun(event, { ...run, ...change }, jobs, { sha })).toThrow();
  });
  it("rejects stale main, missing, duplicate or skipped required checks", () => {
    expect(() => validateRun(event, run, jobs, { sha: "b".repeat(40) })).toThrow();
    expect(() => validateRun(event, run, jobs.slice(1), { sha })).toThrow();
    expect(() => validateRun(event, run, [...jobs, jobs[0]], { sha })).toThrow();
    expect(() => validateRun(event, run, [...jobs.slice(1), { ...jobs[0], conclusion: "skipped" }], { sha })).toThrow();
  });
  it.each([
    { projectId: "other" }, { ownerId: "other" }, { target: "preview" }, { readyState: "ERROR" },
    { meta: { hermeneusCommitSha: "b".repeat(40) } }, { regions: ["iad1"] }, { url: "evil.example" },
    { alias: ["hermeneus-alpha-synthetic.vercel.app"] }, { protectionBypass: { preexisting: {} } },
  ])("rejects deployment target/provenance mismatch %j", (change) => {
    expect(() => validateDeployment({ ...deployment, ...change }, project, sha)).toThrow();
  });
  it("rejects a project with deployment protection disabled", () => {
    expect(() => validateDeployment(deployment, { ...project, ssoProtection: { enabled: false } }, sha)).toThrow();
  });
  it.each(["ready", "503", "redirect", "cached", "public", "wrong-body", "network", "cleanup-failure"])(
    "requires fresh readiness and cleans up its own temporary access: %s", async (mode) => {
      const requests: { url: string; options: RequestInit }[] = [];
      const request = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        requests.push({ url: String(url), options: options! });
        if (requests.length === 1) return Response.json({ protectionBypass: { "private-fixture-bypass": {} } });
        if (requests.length === 3) {
          if (mode === "cleanup-failure") throw new Error("private-fixture-error");
          return Response.json({ protectionBypass: {} });
        }
        if (mode === "network") throw new Error("private-fixture-error");
        return Response.json(mode === "wrong-body" ? { status: "unavailable" } : { status: "ready" }, {
          status: mode === "503" ? 503 : mode === "redirect" ? 302 : 200,
          headers: { "Cache-Control": mode === "cached" ? "public, max-age=60" : mode === "public" ? "public, no-store" : "private, no-store" },
        });
      });
      const result = checkReadiness(deployment, project, sha, "private-fixture-api-token", request);
      if (mode === "ready") await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow();
      expect(requests).toHaveLength(3);
      expect(JSON.parse(requests[0].options.body as string)).toEqual({ ttl: 300 });
      expect(new URL(requests[1].url).origin).toBe("https://synthetic-stage.vercel.app");
      expect(new URL(requests[1].url).pathname).toBe("/api/ready");
      expect(new URL(requests[1].url).searchParams.get("_vercel_share")).toBe("private-fixture-bypass");
      expect(requests[1].options.redirect).toBe("manual");
      expect(requests[1].options.headers).toBeUndefined();
      expect(JSON.parse(requests[2].options.body as string)).toEqual({ revoke: { secret: "private-fixture-bypass", regenerate: false } });
    },
  );
  it.each(["ready", "foreign", "other-path", "query", "missing-cookie", "duplicate-cookie", "invalid-cookie", "second-redirect", "503"])(
    "bounds the real share-link cookie handshake: %s", async (mode) => {
      const calls: { url: string; options: RequestInit }[] = [];
      const request = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options: options! });
        if (calls.length === 1) return Response.json({ protectionBypass: { "private-fixture-bypass": {} } });
        if (String(url).includes("api.vercel.com")) return Response.json({ protectionBypass: {} });
        if (calls.length === 2) {
          const headers = new Headers({ location: mode === "foreign" ? "https://evil.example/api/ready" : mode === "other-path" ? "/handoffs" : mode === "query" ? "/api/ready?secret=echo" : "/api/ready" });
          if (mode !== "missing-cookie") headers.append("Set-Cookie", mode === "invalid-cookie" ? "_vercel_jwt=bad cookie; Secure" : "_vercel_jwt=private.jwt.fixture; Secure; HttpOnly");
          if (mode === "duplicate-cookie") headers.append("Set-Cookie", "_vercel_jwt=other.jwt.fixture; Secure");
          return new Response(null, { status: 307, headers });
        }
        return Response.json({ status: "ready" }, { status: mode === "second-redirect" ? 307 : mode === "503" ? 503 : 200,
          headers: { "Cache-Control": "private, no-store" } });
      });
      const result = checkReadiness(deployment, project, sha, "private-fixture-api-token", request);
      if (mode === "ready") await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow();
      expect(calls.at(-1)!.url).toContain("api.vercel.com/aliases/dpl_Test/protection-bypass");
      expect(JSON.parse(calls.at(-1)!.options.body as string)).toEqual({ revoke: { secret: "private-fixture-bypass", regenerate: false } });
      const forwarded = calls.filter((call) => call.options.headers && "Cookie" in (call.options.headers as object));
      expect(forwarded.length).toBe(["ready", "second-redirect", "503"].includes(mode) ? 1 : 0);
      for (const call of forwarded) {
        expect(call.url).toBe("https://synthetic-stage.vercel.app/api/ready");
        expect(call.options.headers).toEqual({ Cookie: "_vercel_jwt=private.jwt.fixture" });
        expect(call.options.redirect).toBe("manual");
      }
    },
  );
  it("fetches CI jobs from the exact attempt, with bounded requests and no redirects", async () => {
    const calls: { url: string; options: RequestInit }[] = [];
    const request = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      calls.push({ url: String(url), options: options! });
      return Response.json(calls.length === 1 ? run : calls.length === 2 ? { total_count: jobs.length, jobs } : { sha });
    });
    expect(await selectCommit(event, "private-github-fixture", request)).toBe(sha);
    expect(calls[1].url).toBe(`https://api.github.com/repos/${REPOSITORY}/actions/runs/123/attempts/1/jobs?per_page=100`);
    expect(calls.every((call) => call.options.redirect === "manual" && call.options.signal instanceof AbortSignal)).toBe(true);
  });
  it("rejects a redirected CI request before interpreting its body", async () => {
    const request = vi.fn(async () => new Response("private-error-fixture", { status: 302, headers: { location: "https://evil.example" } }));
    await expect(selectCommit(event, "private-github-fixture", request)).rejects.toThrow("Alpha release gate failed");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["https://evil.example", "https://private:password@synthetic-stage.vercel.app", "https://synthetic-stage.vercel.app?private=token"])(
    "never sends Vercel credentials to malformed stage output %s", async (url) => {
      const request = vi.fn(async () => Response.json(request.mock.calls.length === 1 ? run : request.mock.calls.length === 2 ? { total_count: jobs.length, jobs } : { sha }));
      await expect(probe(event, "private-github-fixture", "private-vercel-fixture", url, "dpl_Prior", request)).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(3);
    },
  );
});
