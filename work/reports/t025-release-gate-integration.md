# T-025 — integrated release Gate and activation preparation

## Result

**Integration complete; automatic release awaits a CI credential.**
The owner's 2026-10-13 approval explicitly covers commit, push, merge and
automatic synthetic-release activation. No further permission request is needed
for that scope. T-025 remains IN_PROGRESS until the first hosted release is
observed successful; missing credentials are not evidence of active deployment.

## Exact artifacts and hosted verification

- Local T-024 implementation fingerprint before commit:
  `ca4f6ca834181539b6f9b919a01c8c49cee0a34d58437db327c38f94a377f3b9`.
- [PR #36](https://github.com/CarlosKim-1997/Hermeneus/pull/36) HEAD:
  `e347800db6a2ee56d7943e17a0d3a0e47776e899`.
- [PR CI 38394388834](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38394388834):
  `verify`, `postgres`, `e2e`, `dependency-audit` all PASS. Tested temporary
  merge candidate: `cb07b9ea91b4adea2c8c1d07b258aa6aec867dd0`.
- Integrated main: `e25655178a905f95c8f8da85e5998e08af9dc0c5`.
- [Main CI 38394774004](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38394774004):
  all four required jobs PASS, Node 22.23.3. Auth 72, DB integration 113,
  Playwright 15 PASS. The actual logical restore ran, rather than skipping;
  its dump/restore plus checks took 470ms for this tiny CI fixture (total focused
  test 1063ms). This is not target RPO/RTO or PITR evidence.
- Exercised `validateRun` using actual GitHub API responses for that main run,
  exact attempt's jobs and current main; accepted exactly
  `e25655178a905f95c8f8da85e5998e08af9dc0c5`. This uses GitHub CLI for read-only
  API access and does not verify the Vercel staging/probe/promotion path.

## Protection and preparation

Observed branch protection retains strict/up-to-date required checks:
`verify`, `postgres`, `e2e`, `dependency-audit` (GitHub Actions app 15368).
Required approving review count is 0; no active rulesets were returned.
No administrator bypass or branch-protection change was used.
Supabase Preview was SKIPPED and is not one of the required CI checks.

Created GitHub environment `synthetic-alpha` (ID `24171667727`) with custom
deployment branch policy: only branch `main` (policy ID `62898247`). No required
reviewer was added. Created repository variable `HERMENEUS_ALPHA_AUTO_DEPLOY`
with value `disabled` pending direct credential registration. No token value was
retrieved, copied or printed. Environment secret-name listing remained empty at
this observation. No automatic release run has occurred.

Vercel project `prj_YtYWbSBvS0AvVHiJiqbnRHcIgZA8` in CarlosLab
`team_ll3FPTKyAnl8VYk0CqJ90tHV` still reports Node 22.x and all-deployment SSO
protection. Its observed existing deployment is
`dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG`, READY in icn1, with runtime SHA
`7b014fe3d07ffbde13db6b4c2f84b7d7e9b90749`. No new Vercel deployment,
temporary access link, shared DB change, paid resource or model call was made
during this integration/preparation observation. Other worktrees and unowned
`.codex-remote-attachments/` were preserved.

## One activation prerequisite and next actions

The owner must register a CarlosLab-scoped Vercel token directly in
[synthetic-alpha environment settings](https://github.com/CarlosKim-1997/Hermeneus/settings/environments/24171667727/edit)
as environment secret `VERCEL_TOKEN`.
Create it at [Vercel tokens](https://vercel.com/account/settings/tokens), e.g.
name `Hermeneus GitHub Alpha`, CarlosLab scope, 90-day expiry. Do not send the
token in chat. Existing Codex connector access is not a GitHub runner credential.

Once its name is present, Codex can use the already granted authority to:

1. Confirm the latest trusted main's required CI and actual target settings.
2. Set the repository opt-in to `enabled`.
3. Trigger a current-main successful CI completion (rerun that exact main CI if
   needed) to start the installed workflow. It rejects an obsolete main SHA.
4. Observe staged deployment, readiness, temporary access cleanup and promotion;
   diagnose ordinary failures and reverify without bypassing the Gate.
5. Record exact deployment/CI/SHA/alias evidence and reconcile Current State.

Procedure and residual release/recovery races:
`docs/operations/alpha-release-and-restore.md`. T-024's terminal local-only
Authority is unchanged; this report records the later authorized integration.

The separate real-data Pro/Small/PITR target, target recovery/retention decisions,
fresh participant/protected Share/log checks and live verifier evaluation remain
their existing distinct gates. No automatic real-data readiness claim is made.
