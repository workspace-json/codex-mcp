# Remediation Checklist — proposed only

No item below is authorized by this audit. Pause at every checkpoint.

1. Preserve volatile Git evidence.
   - Evidence: 12 prunable/missing worktrees (including two detached), and numerous unreachable commits from `git fsck --no-reflogs --unreachable`.
   - Later tools: `git fsck --no-reflogs --unreachable`, `git bundle create`, `git format-patch`, `git status --short` in each accessible worktree.
   - Expected result: a named preservation artifact and clean/dirty inventory without altering refs.
   - Checkpoint: human verifies every unreachable commit selected for preservation and that no secrets are copied into a shared location.
   - Rollback: preservation actions are additive; retain originals.
   - Linear: comment HAC-136/HAC-206 only if a relevant preserved commit changes their assessment.
   - Cleanup unlocked: none; this is a prerequisite.

2. Reconcile the release baseline.
   - Evidence: `release/0.1.9@940760d` is one ahead/one behind `origin/main`; main has `7d42a61 release: 0.1.9 (#13)`.
   - Later tools: `git range-diff origin/main...release/0.1.9`, `git diff --stat`, `git patch-id`.
   - Expected result: an explicit equivalent/superseded/divergent decision with files affected.
   - Checkpoint: human selects whether release-only differences matter.
   - Rollback: no mutation occurred; retain both refs.
   - Linear: update/reframe HAC-206 after the decision.
   - Cleanup unlocked: release branch only if equivalence and remote retention are proven.

3. Review the security/config remediation as a bounded patch set.
   - Evidence: `fix/adversarial-review-hac99-hac101` has 4 unique commits, including `.codex/config.toml`, hook and structured-output changes.
   - Later tools: `git range-diff`, targeted tests, `npm run check`, exact-config server/no-write regression test.
   - Expected result: explicit current-main compatibility and security review.
   - Checkpoint: human approves any conflict resolution; do not silently select a policy outcome.
   - Rollback: use a temporary reconciliation PR; close it if gates fail.
   - Linear: HAC-99/HAC-101/HAC-129 only after validation evidence.
   - Cleanup unlocked: none until PR is merged and patches are equivalent.

4. Decide the HAC-136/176/177/178 old patch family.
   - Evidence: three branches share `0041bdf`; Linear HAC-206 calls them stale/regressing, but the patch changes 20 files including fixture and extension code.
   - Later tools: compare `d5fe7a0..0041bdf` to `main`, inspect fixture contract, execute extension and MCP tests.
   - Expected result: preserve, selectively reconstruct, or formally supersede decision.
   - Checkpoint: architecture owner approves any reconstructed fixture/extension behavior.
   - Rollback: branch from current main; abandon only the new reconciliation PR, never the original evidence.
   - Linear: HAC-136 comment/status only after demonstrated GPT-5.6/reviewer criteria.
   - Cleanup unlocked: family aliases only after all unique commits are preserved/integrated/superseded with evidence.

5. Refresh marketplace/onboarding work through a new PR.
   - Evidence: `polish/extension-marketplace-metadata@b9ec0d9` has ten unique commits; HAC-206 explicitly called for a curated merge but targets obsolete 0.1.6.
   - Later tools: create a fresh branch from `main`, selectively reconstruct `4380d63..b9ec0d9`, `npm ci`, `npm run check`, `npm run prepublishOnly` where release-scoped.
   - Expected result: a reviewable PR with current version/installer semantics.
   - Checkpoint: verify packaged artifact and Node 20/22 CI results; inspect resulting release version.
   - Rollback: close PR; no canonical-branch mutation.
   - Linear: post the HAC-206 paste-ready comment and link the PR.
   - Cleanup unlocked: source branch only after PR merge plus patch-equivalence proof.

6. Reconcile Linear, then plan cleanup.
   - Evidence: HAC-136 is In Progress despite stale branches; HAC-206 is a Backlog 0.1.6 inventory while repository is 0.1.9.
   - Later tools: Linear issue/comment reads and authorized updates; `git branch --merged origin/main`; `git worktree list --porcelain`; `git cherry`.
   - Expected result: every issue’s status reflects verified implementation, not code presence.
   - Checkpoint: human reviews every deletion candidate’s unique-commit, clean-status, PR, backup, and Linear evidence.
   - Rollback: do not delete; preservation branches/bundles remain.
   - Linear: apply only approved status/comment changes.
   - Cleanup unlocked: only individually proven worktrees/branches; never a broad prune or garbage collection.
