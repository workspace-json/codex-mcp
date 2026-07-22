# Repository Worktree and Linear Reconciliation Audit — 2026-07-22

## Executive Finding

- **OBSERVED:** Repository is `workspace-json/codex-mcp` (`origin` and `package.json`). The working directory is `/Users/user1/Documents/workspacejson-codex-mcp`.
- **OBSERVED:** `origin/HEAD -> origin/main`; CI only runs push/PR validation for `main` (`.github/workflows/ci.yml`). `main` is therefore the canonical integration branch. Branch protection is **UNKNOWN** because GitHub could not be contacted (DNS failure).
- **OBSERVED:** 15 registered worktrees exist: 2 accessible (root and `.claude/worktrees/readme-hero-polish`), 12 prunable/missing, and 1 detached scratch worktree. The root is clean; no stash exists.
- **OBSERVED:** Four patch-bearing candidates remain outside `origin/main`: the `0041bdf` HAC-136/176/177/178 family, `fix/adversarial-review-hac99-hac101`, `polish/extension-marketplace-metadata`, and the release-only `release/0.1.9` commit.
- **OBSERVED:** The highest-loss risk is unreachable commit history: `git fsck --no-reflogs --unreachable` reported many unreachable commits, and 12 registered worktrees are prunable. Do not prune, remove, or garbage-collect before preservation review.
- **INFERRED:** `release/0.1.9` is a release-line commit already superseded by `origin/main` commit `7d42a61` (“release: 0.1.9 (#13)”), but exact patch equivalence was not proven because its sole commit has a different patch-id sign (`git cherry -v origin/main release/0.1.9` reports `- 940760d`). It is not a cleanup candidate yet.
- **OBSERVED:** Linear workspace/team/project are Marcelle Labs / Hackathon Squad / OpenAI Build Week Hackathon '26'. Relevant issue state conflicts with repository state for HAC-136 (Linear In Progress; several stale experimental branches), HAC-206 (Linear Backlog but describes a prior 0.1.6 cut while repository ships 0.1.9), and the future-facing marketplace branch.
- **Final:** repository is **not ready for cleanup**. First action is preservation/triage of unreachable commits and prunable worktree registrations; no merge is authorized by this report.

## Repository Baseline

| Item | Evidence | Finding |
| --- | --- | --- |
| Remote | `git remote -v` | **OBSERVED** `https://github.com/workspace-json/codex-mcp` |
| Canonical branch | `refs/remotes/origin/HEAD -> origin/main`; CI triggers | **OBSERVED** `main` |
| Current branch | `git status --short --branch` | **OBSERVED** `release/0.1.9`, clean, tracking `origin/release/0.1.9` |
| Package | `package.json` | **OBSERVED** `@workspacejson/codex-mcp@0.1.9`, Node >=20 |
| Remote freshness | `git remote show origin` | **UNKNOWN** network DNS prevented remote query; refs are local cached evidence |
| PR state / required checks | GitHub query unavailable | **UNKNOWN**; CI defines `check:structure`, generator-version, typecheck, lint, build, test, smoke, pack |
| Protected/release branches | CI and local refs | **INFERRED** `main` integration is PR-gated by workflow; release branches exist but protection is UNKNOWN |
| File-context tool | tool discovery | **UNKNOWN/unavailable** `workspace_get_file_context` was not installed in this session; no safety conclusion taken from absence |

Expected validation after any future integration: `npm ci && npm run check`; for package release, `npm run prepublishOnly`. CI uses Node 20 and 22, and `publish-npm.yml` additionally verifies packed artifact installation.

## Worktree and Branch Inventory

| Surface | Path | Branch/Commit | Unique Work | Linear | Validation | Risk | Proposed Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| root | repository root | `release/0.1.9` / `940760d` | version/docs release delta, 8 files | release 0.1.9; HAC-206 indirect | no run (audit-only) | MEDIUM: differs from `main` release commit | `PRESERVE_PENDING_DECISION` |
| detached scratch | `/private/tmp/.../scratchpad/mainwt` | detached `e0827a8` | likely main-era fix; no branch protection | HAC-206 mentions e0827a8 | inaccessible status | HIGH: detached + untracked state unknown | `PRESERVE_PENDING_DECISION` |
| feature worktree | `.claude/worktrees/readme-hero-polish` | HAC-170 / `82d25a7` | patch already in main (`git cherry` empty) | HAC-170 | worktree cleanliness not inspected (nested ignored path) | MEDIUM: accessible but ignored host path | `ALREADY_INTEGRATED` pending clean-status check |
| 10 named prunable feature worktrees | `/private/tmp/workspacejson-hac*` | HAC-102/105/129/136/158/175/178 tips | most patch-equivalent to main; HAC-136/178 tip retains three unique old commits | HAC-102,105,129,136,158,175,178 | paths missing | HIGH: registration is prunable and status/untracked files unavailable | `PRESERVE_PENDING_DECISION` |
| 2 prunable detached worktrees | `/private/tmp/workspacejson-{prepublish-clean,source-repair}-8539c64` | detached `8539c64` | UNKNOWN | UNKNOWN | paths missing | HIGH: detached state, no branch anchor | `PRESERVE_PENDING_DECISION` |
| `feature/hac-136-eligibility-reviewer` family | missing worktree | `0041bdf` | 3 commits/20 files unique vs main: fixture, extension, plugin metadata | HAC-136, HAC-176/177/178 | no current evidence | HIGH: Linear HAC-206 calls it stale/regressing; no deletion proof | `MANUAL_RECONCILIATION_REQUIRED` |
| `fix/adversarial-review-hac99-hac101` | branch only | `8dea6cc` | 4 commits/13 files: config, hook, bounded outputs, tests | HAC-99/101/129/130/131 | unknown current | HIGH: security/read-only posture; 501 lines unique | `MANUAL_RECONCILIATION_REQUIRED` |
| `polish/extension-marketplace-metadata` | branch only | `b9ec0d9` | 10 commits/15 files: installer/onboarding/version gate | HAC-175,197,200,203,204,206 | no current evidence | HIGH: HAC-206 explicitly says curated merge, but release is now 0.1.9 | `REBASE_OR_REFRESH_CANDIDATE` |
| `feature/release-npm-workflow` | branch only | `05a3073` | six unique historical commits, overlaps HAC-136 family | HAC-176/177/178 | no current evidence | MEDIUM: Linear HAC-206 calls stale/regressing | `SUPERSEDED` (preserve until reconciliation) |
| `polish/output-channel-yaml` | branch only | `c10ac8c` | `git cherry` empty | HAC-170 | merged as `c14ef4e` / PR #8 inferred from commit | LOW | `ALREADY_INTEGRATED` |
| legacy backups/rebases/dev/integration | branches only | listed in JSON | no unique patch or obsolete history | HAC-97/114/158/111 | no current evidence | MEDIUM: no cleanup without unreachable review | `PRESERVE_PENDING_DECISION` |

Full stable identifiers, all 30 local branches, all 15 worktrees, and branch divergence are in `repository-reconciliation.json`.

## Linear Reconciliation Matrix

| Linear Issue | Current Linear State | Observed Implementation State | Evidence | Proposed Update |
| --- | --- | --- | --- | --- |
| HAC-97 | Done | `INTEGRATED` | `feature/hac-97-freeze-fixture-contract` has no unique patch; branch merged | Leave unchanged; add no comment without validation evidence |
| HAC-99 | Done | `IMPLEMENTED_UNVERIFIED` | unique remediation branch `fix/adversarial-review-hac99-hac101` remains outside `main` | Do not reopen until patch/content comparison against shipped 0.1.9 completes |
| HAC-101 | Done | `IMPLEMENTED_UNVERIFIED` | Linear says shipped 4-tool contract; branch traceability absent | Leave unchanged; attach audit finding only after validation |
| HAC-102 | Done | `IMPLEMENTED_UNVERIFIED` | prunable branch `47f44c1` patch-equivalent to main; Linear acceptance requires proof task | Request/locate validation record; no status change |
| HAC-105 | Done | `IMPLEMENTED_UNVERIFIED` | prunable audit branch patch-equivalent to main | Leave unchanged; audit output may be attached later |
| HAC-129 | Done | `IMPLEMENTED_UNVERIFIED` | Linear links PR #1; remediation patch still unique in local branch | Compare `0821fac..8dea6cc` with 0.1.9 before asserting shipped |
| HAC-136 | In Progress | `IMPLEMENTED_UNVERIFIED` | Linear comments report real GPT-5.6 reviewer calls and attributed extension UI, but the latest correction says this still does not satisfy the full product/demo/docs requirement; old unique branch family remains | Keep In Progress; do not close without a current product-path, demo, and documentation verification |
| HAC-158 | Done | `INTEGRATED` | `.agents/skills/*` exists untracked but root’s audit skill set matches issue deliverables; historical branch patch-equivalent | Leave unchanged; separately decide whether local skills should be committed |
| HAC-170 | Done | `INTEGRATED` | output-channel branch has no unique patch; main has PR #8 commit | Leave unchanged |
| HAC-175 | Done | `IMPLEMENTED_UNVERIFIED` | prunable `7038201` patch-equivalent; later marketplace branch includes related onboarding | Leave unchanged pending current release validation |
| HAC-176/177/178 | Done | `INTEGRATED` with stale alternate branches | `main` contains later delivery; old `0041bdf` family unique only against latest main and expressly marked stale in HAC-206 | Leave unchanged; preserve old commits until architectural review |
| HAC-206 | Backlog | `ISSUE_DESCRIPTION_STALE` | issue names 0.1.6 plan; repo package/release are 0.1.9 | Update issue with audit comment and either close/supersede or create 0.1.10 inventory |

## Duplicate and Superseded Work

- **OBSERVED:** `feature/hac-136-eligibility-reviewer`, `feature/hac-176-177-release-ready`, and `feature/hac-178-tracked-demo-source` point to `0041bdf`; classify as one patch family, not three independent deliverables.
- **OBSERVED:** `feature/hac-136-decoration-plumbing` and `fix/hac-129-npx-entrypoint` point to `f62ce3e`; `feature/hac-136-reauthored` and `feature/hac-158-skills-reauthored` point to `8824c9b`.
- **OBSERVED:** `backup/hardened-17588dd` and `dev` point to `17588dd`.
- **OBSERVED:** `polish/output-channel-yaml` has no positive `git cherry` entries against `origin/main`; it is already integrated.
- **INFERRED:** stale local branches that have no unique patches are history aliases rather than integration candidates. They remain preservation candidates until their worktree state is inspected.

## Conflict and Dependency Graph

```text
Wave 0 preserve unreachable commits + prunable worktree state
  └─> compare release/0.1.9 <-> origin/main release commit
       ├─> security/config patch family (HAC-99/101/129) review
       └─> HAC-136/HAC-176/177/178 old fixture/extension family decision
            └─> marketplace/onboarding branch refresh (HAC-175/206)
                 └─> npm run check + packed-artifact test
                      └─> Linear reconciliation and only then cleanup
```

`fix/adversarial-review-hac99-hac101` and the HAC-136 family overlap `src/services/workspace.ts`, tests, `.codex` configuration, fixtures, and extension surfaces; they require manual architecture/patch review. No direct merge is recommended.

## Proposed Merge Sequence

1. **Wave 0 — preservation:** capture bundles/patches and clean-status evidence for every prunable/detached worktree; retain unreachable commits. Human approval required.
2. **Wave 1 — reconcile release baseline:** range-diff `release/0.1.9` against `origin/main` and determine whether `7d42a61` supersedes `940760d`. Do not merge either merely to converge.
3. **Wave 2 — manual candidates:** separately review bounded security patch `0821fac..8dea6cc` and `0041bdf` family. Select patches only after current API and fixture contract comparison.
4. **Wave 3 — marketplace:** if still desired, create a fresh PR branch from current `main`, reconstruct/refresh `4380d63..b9ec0d9`, resolve version drift, then run `npm run check`; use PR, never direct merge.
5. **Wave 4 — validation and Linear:** run Node 20/22 CI-equivalent checks and packed-artifact installation; then apply proposed Linear comments/statuses.
6. **Wave 5 — cleanup:** only after Waves 0–4, and only with clean worktrees, no unique commits, preserved bundles, resolved PR state, and explicit approval.

## Proposed Linear Updates

**HAC-136 paste-ready comment (no status change):**

> Reconciliation audit 2026-07-22: legacy worktrees for this issue are prunable/missing and point to an older `0041bdf` patch family that remains outside current `origin/main`. The issue requires a demonstrable GPT-5.6 advisory reviewer and visible surface; this audit found no current validation run proving those acceptance criteria against `@workspacejson/codex-mcp@0.1.9`. Keep In Progress. Next gate: preserve the detached/prunable state, compare the patch family to current main, then run the required product-path and render validations before changing status.

**HAC-206 paste-ready comment (recommended: supersede/close only after owner confirms release scope):**

> Reconciliation audit 2026-07-22: this issue describes a 0.1.6 merge plan, while the checked repository package and release branch are 0.1.9 and `origin/main` contains `7d42a61` “release: 0.1.9 (#13)”. The old marketplace payload `polish/extension-marketplace-metadata` still has ten unique commits and has not been validated against current main. Please either (a) supersede this issue with a new current-version merge inventory, or (b) explicitly retain it and update the target version, candidate commit range, and validation gates. Do not mark the payload integrated without a refreshed PR and `npm run check` evidence.

## Cleanup Candidates

None are ready now. Future commands (not executed) must follow successful verification: `git worktree remove <validated-path>`, `git branch -d <validated-branch>`, and only then `git worktree prune`. No force deletion, `git gc`, or stash drop is proposed.

## Items Requiring Human Judgment

1. Whether the 0.1.9 release-line delta is intentionally replaced by main’s `7d42a61` release commit.
2. Whether the old HAC-136 fixture/extension family contains any requirement still missing from current main.
3. Whether the marketplace/onboarding branch is desired for a post-0.1.9 release, and its intended version.
4. Whether ignored `.agents/skills`, `.claude`, and `.local` content is user-local operational state or should receive separate tracking review. Local reviewer receipts may contain sensitive request/response data; do not publish them in an audit attachment.

## Unknowns and Missing Evidence

GitHub open/merged PR and required-check state, branch-protection rules, remote freshness, actual contents/status of 12 prunable worktrees, and stashes in those missing worktrees were not established. GitHub remote access failed DNS. Linear HAC-136 and HAC-206 comments were read: HAC-136 explicitly retains an In Progress requirement for a genuine product-path/demo/docs proof, and HAC-206 records 0.1.7 shipped-byte evidence plus pending render/billfold gates; those comments do not prove the current 0.1.9 release satisfies all acceptance criteria. `git fsck` also reported invalid `refs/.DS_Store`, a repository metadata hygiene defect that should be investigated non-destructively.

## Final Recommendation

Remediation should **not** start with cleanup or merge. Safest first action: under explicit execution authorization, create preservation bundles for unreachable commits and inspect/prune-registration candidates without deletion; then reconcile the release baseline and only afterward refresh a selected candidate into a new PR branch.
