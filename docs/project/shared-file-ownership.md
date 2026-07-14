# Shared-file ownership during the Build Week window

`main` is the submission artifact. Merge one reviewed, self-contained change
directly to `main` at a time; run the full publish gate on `main` after every
merge. Do not accumulate changes on an integration branch.

## Serial owners

| Files | Owner | Rule |
| --- | --- | --- |
| `package.json`, `package-lock.json`, `LICENSE`, `.github/workflows/**` | HAC-110 serial packaging/CI lane | No other lane edits these files. Required changes are a small serial owner commit, merged before dependent work is rebased. |
| `README.md`, `STATUS.md`, `MORNING-HANDOFF.md`, `docs/**` | Documentation lane | Public-claim edits require `docs-claim-sync`; handoffs must distinguish observed evidence from unavailable gates. |
| `.codex-plugin/plugin.json`, `.mcp.json`, `.codex/**` plugin/agent manifests | HAC-129 manifest lane | Keep manifest and installation-surface changes isolated from runtime and documentation work. |
| `hooks/**`, hook adapters, `hooks/pre-edit-check.mjs` | HAC-100 hook lane | Preserve deterministic enforcement semantics; reviewer output never becomes hook authority. |

## Extraction rule

A stale branch is a donor, not a merge source. Create a fresh branch from current
`main`, re-apply only its intended content, and verify it on that base. Do not
checkout/cherry-pick a stale branch's files just because an earlier tree was
green.

If a branch changes a file outside its owner lane, strip that change. If it is
actually required, create a small serial commit in the owning lane with its own
review and verification record.

## Per-merge gate

After each direct merge to `main`, run the repository publish gate and explicitly
verify `npm pack --dry-run` tarball contents. A failed gate belongs to that merge;
do not add another branch until it is resolved or reverted.

## Current ordering

1. HAC-110 is the landed base for package/CI work.
2. Re-author HAC-158 skills from current `main`; do not port its 37-file branch.
3. Re-author README-only work after claim sync; discard repository-structure
   relocation work during the window.
4. Merge HAC-121 assets only after the provisional-claims audit.
5. Run HAC-136 remediation in parallel. It remains the eligibility gate and is
   not queued for merge until it is committed and reviewer-clean.

The controlled fixture remains in its separate repository. Its history is proof
material and must not be merged into this repository.
