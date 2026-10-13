# T-025 — generated alias staging boundary

## Later full probe and promotion repair

PR #41 HEAD `006fa598c2185d679a5c2b6d27a769417f4c7273` passed CI
`38421241835`; main `c742b9cd7421842ee3484f1840260fc660310bae` passed
`38421674938`. Release `38422028034` staged READY
`dpl_4b7JvxNtbxUY733KRVQCF9Fwaexx`, passed readiness/access cleanup and made
the single promotion API request. The job reported an unclassified failure,
but fresh primary-alias inspection confirmed it now points to that exact
artifact. Thus mutation succeeded; do not repeat it blindly. The helper parsed
the success response as JSON, while the official CLI uses `json: false` for
this endpoint. Accept successful HTTP status without parsing this empty body,
then verify the primary mapping as before. Add a 204 empty-response regression.
This repair does not change target checks, mutation count or authorization.

PR #40 HEAD `530d52c67273af3f47bfcfc8d50bee2f59137479` passed CI
`38419354325`; integrated main `8d5b3a6894a74e08e73f1e31c1d284160a03cb84`
passed all four checks in `38419860182`. Automatic release `38420209954`
staged `dpl_5mRMACisSnMDysgG1CTQDVFGQxSa`, and its actual hosted target,
primary mapping, readiness and temporary-access cleanup step PASS. The CLI
promotion step then failed with an unclassified error; its suppressed output
does not establish the precise underlying status. Fresh reads confirmed the
primary and restored secondary still point to the previous verified deployment.
No interrupted routing change is assumed. The automatic opt-in was disabled
while repairing this ordinary compatibility problem.

Use the same official `/v10/projects/{projectId}/promote/{deploymentId}` API
that CLI 63.1.2 calls for an already-production artifact. This removes the CLI's
separate account-context discovery without widening token permissions. Keep
fresh CI/main and target validation and check the captured primary immediately
before a single POST with `{}`. Poll only the fixed primary's mapping; accept
the captured prior during bounded waiting and success only at the exact target.
Reject a third deployment, redirects, API refusal, unknown outcome or timeout.
Do not repeat the POST or rebuild. Response bodies, API credentials and cookies
are never printed. Eight added cases cover success/202 waiting, drift before
and after, denial, redirect, transport failure and bounded timeout. Local Gate
64, typecheck/Governance/whitespace PASS. Adversarial review confirms unchanged
target/protection checks, single mutation and no force/check bypass. Hosted
integration and complete promotion remain pending at this observation.

## Observed result

The owner registered `VERCEL_TOKEN` directly in `synthetic-alpha`; only its name
was inspected. CLI credential compatibility repair PR #39 HEAD
`969f05378a6006c26fe68bd6128e65c2427ec861` passed required CI `38416362900`
and merged as `83d42ef2a474223849d35ba432aca4ea33945728`. Main CI
`38416854496` passed all four required jobs.

Automatic release [38417177954](https://github.com/CarlosKim-1997/Hermeneus/actions/runs/38417177954)
successfully selected that main, verified its token against the protected project,
and built production artifact `dpl_8E9NcxuRMqakYtK4nYAy1Phu7RB3` in `icn1`.
Its immutable URL is `hermeneus-alpha-synthetic-azkblab5h-carloslab.vercel.app`.
The probe failed and promotion was skipped. The observed nonempty alias list
necessarily violates the Gate; the generic log does not establish that it was
the first failing condition. Full probe/readiness/cleanup are not claimed.
Validation rejects that alias before creating temporary access.

Despite `--prod --skip-domain`, the generated base alias
`hermeneus-alpha-synthetic-carloslab.vercel.app` moved to the candidate. The
project domain `hermeneus-alpha-synthetic.vercel.app` stayed on existing verified
deployment `dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG`. Project domain listing contains
only that primary domain; the moved address is a provider-generated CLI alias.
Vercel's [generated URL documentation](https://vercel.com/docs/deployments/generated-urls)
documents the project/scope CLI URL and possible author/scope URL. CLI 63.1.2
source maps `--skip-domain` to `autoAssignCustomDomains: false`. This inspection
did not find a supported switch guaranteeing zero generated aliases.

The opt-in was returned to `disabled`; there is no running release. Automatic
approval review initially rejected reassignment of the secondary alias as a
separately unapproved rollback-like routing action. The owner then explicitly
approved that exact restoration. Reassignment succeeded, and a fresh alias read
confirmed the secondary now points to `dpl_2MmV7DPFebTPVRqtSKnzk8FxLTiG`.
Both service addresses therefore retain the earlier verified runtime. The
candidate remains for inspection, with no promoted primary domain.

## Owner-approved bounded contract amendment

For the existing synthetic-only Alpha, use
`hermeneus-alpha-synthetic.vercel.app` as the sole participant/service address.
Permit only the exact observed generated base alias to follow candidate uploads,
under unchanged all-deployment Vercel Authentication. It can serve a candidate
before readiness verification; do not present it as a tested service address.
Reject every other candidate alias, including the primary domain. Do not add
optional author aliases speculatively.

Before staging, capture the primary alias's deployment ID and validate its
project. Before probe and promotion, require that mapping remains unchanged.
Keep exact main/CI, fixed project/team, SHA metadata, Seoul, protected immutable
readiness URL, temporary-access revocation and same-artifact promotion checks.
After promotion verify the primary domain points to that exact artifact.
Test generated-alias allowlisting, unauthorized aliases, primary mapping drift,
failed readiness and cleanup. Re-enable only after this amended boundary is
explicitly accepted, integrated and verified through required CI.

On 2026-10-14 the owner explicitly accepted the recommended primary-domain
Gate and permitted the exact generated secondary alias to move before readiness.
The implementation captures and validates the primary mapping in the credential
step, rejects drift before temporary readiness access and before promotion, and
verifies its new mapping after promotion. Other aliases remain denied. Local
Gate 56, typecheck/Governance/whitespace PASS. Adversarial diff review checks
that the exception is literal, all-deployment protection remains required, API
credentials stay on fixed origins, and a drift failure cannot create access or
reach promotion. The existing CI and readiness/cleanup failures still fail
closed; this internal review is not independent third-party assurance.

This changes the execution contract's earlier claim that staging changes no
Alpha addresses. It changes no formal Canon meaning or public-data permission.
Nevertheless, accepting a stable address serving an unverified candidate is a
deployment safety decision for the owner, not a silent implementation exception.
The specific owner decision above supplies this amended execution authority;
the earlier general activation approval alone did not supply it.

Alternative: retain the strict zero-alias contract and keep unattended releases
disabled while preparing a separately isolated staging architecture. Its exact
resource, credential, billing and release implications must be reviewed before
external mutations. No extra project, paid resource, DB mutation, model call,
GitHub protection change or real-data deployment occurred here.
