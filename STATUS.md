# Operational status

Append-only implementation log. Claims below are backed by the recorded commands.

## 2026-07-13 — session baseline

- Scope: Build Week submission-critical implementation.
- Starting commit: `43eb423`.
- Baseline files committed: `.claude/settings.json`,
  `.claude/agents/adversarial-reviewer.md`.
- Validation command:
  `npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`.
- Observed result: typecheck and Biome passed; 49 unit tests passed; smoke reported
  `ALL GREEN`; package dry-run contained 24 files; publint reported `All good!`.
- Environment note: the first package check could not write the user npm cache
  because it contains root-owned files. Re-running with the isolated temporary
  cache completed successfully; no global cache ownership was changed.
- Open work: HAC-96, HAC-129, HAC-130, HAC-131, HAC-135, HAC-136 and downstream
  packaging/evidence tasks.

## 2026-07-13 — implementation and packed audit

- HAC-129: project config and CLI help now invoke the `server` subcommand; regression
  tests cover both paths.
- HAC-130: malformed, missing, and unparseable intelligence fails open with explicit
  unavailable context; integrated hook cases pass.
- HAC-131: structured MCP results are bounded to 12,000 characters, report honest
  truncation, and retain the primary deny assessment; real-MCP boundary probes pass.
- HAC-113: `workspace_list_fragile_files` surfaces bounded primitive framework
  context without adding a fifth tool.
- HAC-135: repository guidance, execution plan, runbook, and this append-only log
  are present.
- HAC-136 substrate: project-scoped reviewer is pinned to GPT-5.6/high, read-only,
  installed by the fallback installer, and documented as advisory-only.
- Packaging: complete manifest metadata, repo marketplace entry, reviewer tarball
  inclusion, idempotent install, and managed uninstall are implemented.
- Validation: 58 unit tests passed; the built-server/hook smoke suite reported
  `ALL GREEN`; package dry-run and publint passed.
- Clean install: the real tarball installed in `/tmp`, exposed four tools, returned
  a bounded deny, blocked the checkout-only hook case, and fully removed managed
  config on teardown. See `docs/clean-install-audit.md`.
- Fixture: artifact blob/SHA-256 and proof relationship recorded in
  `docs/fixture-verification.md`. External source repo/commit and three-run baseline
  remain a human gate.

## 2026-07-13 — adversarial remediation and final verification

- First live review: `gpt-5.6-sol`, high reasoning, read-only, session
  `019f5de0-581c-7e60-abc6-708f0ca28a9c`; verdict `BLOCK`. Reproduced findings
  covered malformed artifact roots, later-deny loss, dishonest bounded counts,
  unsafe installer collisions, inherited MCP scope, repository-boundary discovery,
  and an ephemeral hook path.
- Remediation: invalid roots/sections now become explicit unavailable warnings;
  the highest-severity deny is protected; returned/total list counts are honest;
  discovery stops at the nearest Git boundary; the reviewer declares only the
  workspacejson MCP; installation uses ownership markers, atomic config writes,
  and a stable runtime copy; unmanaged collisions are refused and preserved.
- Validation command:
  `TMPDIR=/tmp npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`.
  Final observed result: typecheck/lint passed, 69 unit tests passed, smoke reported
  `ALL GREEN`, the package contained 25 files, and publint reported `All good!`.
- Final packed audit: tarball SHA-1
  `84d54f452acf2e131b1c0f4c5fd539be0c8d00b9`; offline clean install added 94
  packages; two installs were idempotent; the stable hook denied the checkout-only
  case; a real MCP client listed four tools and returned a bounded deny; install and
  uninstall preserved an unrelated indented table and its config's `0600` mode;
  uninstall removed every owned artifact.
- Reviewer runtime note: the configured custom-agent spawn failed in Codex 0.144.3
  with `no thread with id`. Direct `gpt-5.6-sol`/high/read-only review succeeded and
  produced the blocking evidence above. Final focused review session
  `019f5e18-85be-72f3-8b42-98634f9cd861` verified the TOML-boundary and file-mode
  remediations and returned `VERDICT: PASS` with no reproducible defect.
- Unresolved human gates: HAC-96 external fixture/source proof, marketplace UI and
  non-macOS checks, the voiced public demo, final `/feedback` Session ID, and final
  submission assembly.
- Closing marker: the commit containing this entry follows baseline `43eb423` and
  the final gate above; Git history is the canonical immutable identifier.

## 2026-07-13 — HAC-114 CI completion

- Issue: HAC-114. Starting commit: `17588dd`; implementation commit: `e422b5f`.
- Allowed files: `.github/workflows/ci.yml`, `README.md`, and append-only
  `STATUS.md`; no runtime, package, lockfile, hook, evidence, or fixture files
  changed.
- Files changed by the implementation commit: `.github/workflows/ci.yml` and
  `README.md`. CI now reports `npm audit --audit-level=high` without blocking the
  matrix, and README carries the CI badge after an observed successful workflow
  run (`29286355269`).
- Workspace intelligence: `workspace_get_file_context` was unavailable in this
  session. Fragility and co-change context for the edited files therefore remains
  unavailable and was not treated as approval.
- Issue-specific command:
  `npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm audit --audit-level=high`.
  Observed result: `found 0 vulnerabilities`.
- Publish gate:
  `npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`.
  Observed result: typecheck and Biome passed; 69 tests passed; smoke reported
  `ALL GREEN`; the dry-run package contained 25 files; publint reported
  `All good!`.
- Diff checks: `git diff --check` passed; implementation diff was 6 insertions in
  2 files.
- Read-only GPT-5.6 Sol/high review returned `VERDICT: PASS` with no findings;
  session `019f5e4d-e3c2-7833-a820-32ae3d9c61b0`. The verdict was advisory only.
- Remote handoff: branch `feature/hac-114-ci-audit-badge` was pushed. Draft PR #2
  was immediately closed because remote `main` does not contain continuation
  baseline `17588dd`, making the PR show 29 files rather than the issue-scoped two.
  Recreate the PR only after selecting or integrating the correct baseline.
- Unresolved risk: the changed workflow has not run in GitHub Actions because the
  only available PR base has the baseline mismatch. Do not mark HAC-114 Done until
  the issue-scoped commit receives a green run against the correct base.
- Next issue unblocked: HAC-158 can proceed independently; HAC-120/121/122 remain
  limited to preparatory work until HAC-96/HAC-98 external evidence exists.

## 2026-07-13 — HAC-158 repository-local skills

- Issue: HAC-158. Starting commit: `17588dd`; implementation commit: `7d0ef98`.
- Dedicated worktree: `/private/tmp/workspacejson-hac158`; branch:
  `feature/hac-158-repository-skills`.
- Allowed files: `.agents/skills/**`, `AGENTS.md`, and append-only `STATUS.md`.
  No runtime, package, lockfile, CI, hook, README, evidence, fixture, or public-claim
  files changed.
- Implementation files: `AGENTS.md` plus `SKILL.md` and `agents/openai.yaml` for
  `implementation-strategy`, `code-change-verification`, `docs-claim-sync`, and
  `release-candidate-review` under `.agents/skills/`.
- Workspace intelligence: `workspace_get_file_context` was unavailable in this
  session. Fragility and co-change context for all target files is unavailable and
  was not treated as approval.
- Structural validation: ran the skill-creator `quick_validate.py` separately for
  all four skill directories; each returned `Skill is valid!`. `rg` found no
  remaining scaffold TODO or malformed default prompt.
- Forward tests: fresh Codex sessions selected the implementation, verification,
  claim-sync, and release-review workflows from repository guidance. A controlled
  required check exiting 23 produced overall `FAIL`; synthetic copy claiming five
  tools and guaranteed safety produced a pre-edit drift report; a 25-file packed
  artifact with SHA-256
  `96586e05443f8808a7af4d6826f9adf734ec7743ab98ba0774350530b4acb699`
  was rejected at the HAC-124 entry gate because the claim matrix and HAC-98 packet
  are unavailable.
- Skill iteration: the synthetic drift test exposed an ambiguous tier inference.
  `docs-claim-sync` now states that contracts and documentation are claims, not
  evidence records; without underlying evidence the tier remains `ASSERTED`.
- Clean dependency command:
  `npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm ci`. The first
  sandboxed attempt ended with an npm internal exit-handler error; the approved
  rerun completed, added 153 packages, audited 154, and found 0 vulnerabilities.
- Clean publish-gate command:
  `npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`.
  Observed result: failed 1 of 69 tests because installer tests require `dist/`
  before the script's build step (`ENOENT .../dist`). This is a pre-existing
  `17588dd` ordering defect outside HAC-158's allowed files.
- Follow-up validation: `npm run build &&
  npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`
  passed typecheck/Biome, all 69 tests, smoke `ALL GREEN`, the 25-file package
  dry-run, and publint `All good!`. This does not erase the clean-checkout failure.
- Diff checks: cached `git diff --check` passed; implementation scope was 249
  insertions in 9 files.
- Final GPT-5.6 Sol/high review session
  `019f5e62-ff62-7e82-8505-10b6df83abab` returned `VERDICT: PASS` for the HAC-158
  skill changes and kept the clean-publish defect as an independent blocker.
- Unresolved risks: do not mark HAC-158 Done until the clean-checkout publish gate
  is resolved or explicitly accepted and the full release-candidate skill is run
  after the claim matrix/HAC-98 packet exist. The skills add workflow guidance;
  deterministic hooks and CI remain the enforcement backstops.
- Next work: safe preparatory portions of HAC-120/121/122 may proceed, but final
  screenshots, VERIFIED wording, recording, and submission assets remain blocked
  by HAC-96/HAC-98 and human claim approval.
