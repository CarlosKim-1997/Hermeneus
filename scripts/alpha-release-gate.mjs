import { readFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

export const REPOSITORY = "CarlosKim-1997/Hermeneus";
export const TEAM = "team_ll3FPTKyAnl8VYk0CqJ90tHV";
export const PROJECT = "prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8";
const JOBS = ["verify", "postgres", "e2e", "dependency-audit"];
const requireGate = (condition) => { if (!condition) throw new Error("Alpha release gate failed"); };

export function validateRun(event, run, jobs, main) {
  requireGate(event?.repository?.full_name === REPOSITORY);
  requireGate(event?.workflow_run?.id === run.id && event.workflow_run.run_attempt === run.run_attempt);
  requireGate(run.repository?.full_name === REPOSITORY && run.head_repository?.full_name === REPOSITORY);
  requireGate(run.event === "push" && run.head_branch === "main" && run.status === "completed" && run.conclusion === "success");
  requireGate(run.path === ".github/workflows/ci.yml" && /^[a-f0-9]{40}$/.test(run.head_sha));
  requireGate(main.sha === run.head_sha);
  for (const name of JOBS) {
    const matches = jobs.filter((job) => job.name === name);
    requireGate(matches.length === 1 && matches[0].status === "completed" && matches[0].conclusion === "success");
  }
  return run.head_sha;
}

// No caller-provided origin is allowed to receive API credentials.
async function jsonRequest(origin, pathname, token, options = {}, request = fetch) {
  requireGate(typeof token === "string" && token.length > 0);
  const response = await request(new URL(pathname, origin), {
    ...options, redirect: "manual", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  requireGate(response.ok);
  return response.json();
}

export async function selectCommit(event, token, request = fetch) {
  const id = event?.workflow_run?.id, attempt = event?.workflow_run?.run_attempt;
  requireGate(event?.repository?.full_name === REPOSITORY && Number.isSafeInteger(id) && Number.isSafeInteger(attempt));
  const base = `/repos/${REPOSITORY}`;
  const run = await jsonRequest("https://api.github.com", `${base}/actions/runs/${id}`, token, {}, request);
  const jobs = await jsonRequest("https://api.github.com", `${base}/actions/runs/${id}/attempts/${attempt}/jobs?per_page=100`, token, {}, request);
  requireGate(jobs.total_count <= 100 && jobs.jobs?.length === jobs.total_count);
  const main = await jsonRequest("https://api.github.com", `${base}/commits/main`, token, {}, request);
  return validateRun(event, run, jobs.jobs, main);
}

function validateProject(project) {
  requireGate(project.id === PROJECT && project.accountId === TEAM);
  // REST project protection is nullable and uses deploymentType; the MCP summary
  // also adds an enabled flag. Do not mistake that summary for the wire schema.
  requireGate(project.ssoProtection?.deploymentType === "all" && project.ssoProtection?.enabled !== false);
}

export async function checkCredential(token, request = fetch) {
  const project = await jsonRequest("https://api.vercel.com", `/v9/projects/${PROJECT}?teamId=${TEAM}`, token, {}, request);
  validateProject(project);
}

export function validateDeployment(deployment, project, sha) {
  validateProject(project);
  requireGate(deployment.projectId === PROJECT && deployment.ownerId === TEAM);
  requireGate(deployment.target === "production" && deployment.readyState === "READY");
  requireGate(deployment.meta?.hermeneusCommitSha === sha);
  requireGate(Array.isArray(deployment.regions) && deployment.regions.length === 1 && deployment.regions[0] === "icn1");
  requireGate(/^dpl_[a-zA-Z0-9]+$/.test(deployment.id));
  requireGate(/^[a-zA-Z0-9-]+\.vercel\.app$/.test(deployment.url));
  // --skip-domain must have left the current production aliases untouched.
  requireGate(Array.isArray(deployment.alias) && deployment.alias.length === 0);
  requireGate(Object.keys(deployment.protectionBypass ?? {}).length === 0);
  return `https://${deployment.url}`;
}

export async function checkReadiness(deployment, project, sha, token, request = fetch) {
  const origin = validateDeployment(deployment, project, sha);
  const endpoint = `/aliases/${deployment.id}/protection-bypass?teamId=${TEAM}`;
  let ownedSecret;
  try {
    // Fresh staged deployment only. Five-minute expiry also bounds an interrupted runner.
    const created = await jsonRequest("https://api.vercel.com", endpoint, token, {
      method: "PATCH", body: JSON.stringify({ ttl: 300 }),
    }, request);
    const keys = Object.keys(created.protectionBypass ?? {});
    requireGate(keys.length === 1);
    ownedSecret = keys[0];
    const endpointUrl = `${origin}/api/ready`;
    const shareUrl = new URL(endpointUrl);
    shareUrl.searchParams.set("_vercel_share", ownedSecret);
    // Deployment share links are not project-wide automation header secrets.
    // Perform their one-hop cookie exchange, never a general redirect chain.
    let response = await request(shareUrl, {
      redirect: "manual", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 307) {
      const location = response.headers.get("location");
      requireGate(location && new URL(location, endpointUrl).href === endpointUrl);
      const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0])
        .filter((cookie) => cookie.startsWith("_vercel_jwt="));
      requireGate(cookies.length === 1 && /^_vercel_jwt=[A-Za-z0-9._-]+$/.test(cookies[0]));
      response = await request(endpointUrl, {
        redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Cookie: cookies[0] },
      });
    }
    const cacheControl = response.headers.get("cache-control") ?? "";
    requireGate(response.status === 200 && /\bno-store\b/i.test(cacheControl) && /\bprivate\b/i.test(cacheControl));
    const body = await response.json();
    requireGate(body.status === "ready" && Object.keys(body).length === 1);
  } finally {
    if (ownedSecret) {
      const revoked = await jsonRequest("https://api.vercel.com", endpoint, token, {
        method: "PATCH", body: JSON.stringify({ revoke: { secret: ownedSecret, regenerate: false } }),
      }, request);
      requireGate(revoked.protectionBypass && !(ownedSecret in revoked.protectionBypass));
    }
  }
}

export async function probe(event, githubToken, vercelToken, stagedUrl, request = fetch) {
  const sha = await selectCommit(event, githubToken, request);
  const url = new URL(stagedUrl.trim());
  requireGate(url.protocol === "https:" && /^[a-zA-Z0-9-]+\.vercel\.app$/.test(url.hostname));
  requireGate(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/");
  const deployment = await jsonRequest("https://api.vercel.com", `/v13/deployments/${url.hostname}?teamId=${TEAM}`, vercelToken, {}, request);
  const project = await jsonRequest("https://api.vercel.com", `/v9/projects/${PROJECT}?teamId=${TEAM}`, vercelToken, {}, request);
  requireGate(deployment.url === url.hostname);
  await checkReadiness(deployment, project, sha, vercelToken, request);
  return { sha, id: deployment.id };
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const action = process.argv[2];
  if (action === "select") {
    const sha = await selectCommit(event, process.env.GITHUB_TOKEN);
    await appendFile(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
  } else if (action === "credential") {
    await checkCredential(process.env.VERCEL_TOKEN);
    console.log("Synthetic Alpha deployment credential and protected project verified");
  } else if (action === "probe") {
    const result = await probe(event, process.env.GITHUB_TOKEN, process.env.VERCEL_TOKEN,
      await readFile(process.env.STAGED_URL_FILE, "utf8"));
    await appendFile(process.env.GITHUB_OUTPUT, `deployment=${result.id}\nsha=${result.sha}\n`);
  } else if (action === "promote") {
    // Recheck CI/main immediately before the irreversible alias assignment.
    const sha = await selectCommit(event, process.env.GITHUB_TOKEN);
    requireGate(sha === process.env.RELEASE_SHA && /^dpl_[a-zA-Z0-9]+$/.test(process.env.DEPLOYMENT_ID));
    const deployment = await jsonRequest("https://api.vercel.com", `/v13/deployments/${process.env.DEPLOYMENT_ID}?teamId=${TEAM}`, process.env.VERCEL_TOKEN);
    const project = await jsonRequest("https://api.vercel.com", `/v9/projects/${PROJECT}?teamId=${TEAM}`, process.env.VERCEL_TOKEN);
    validateDeployment(deployment, project, sha);
    const child = spawn(process.env.VERCEL_CLI, ["promote", process.env.DEPLOYMENT_ID, "--timeout", "120s"], {
      stdio: "ignore", timeout: 150_000,
    });
    await new Promise((resolvePromise, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error("Promotion failed")));
    });
    console.log(`Promoted synthetic Alpha ${process.env.DEPLOYMENT_ID} at ${sha}`);
  } else throw new Error("Unknown release action");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Synthetic Alpha release stopped. Inspect authenticated deployment state before retrying."); process.exitCode = 1; });
}
