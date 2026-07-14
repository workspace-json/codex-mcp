# Checkout fixture verification

Status: v2 reconstructed locally; not merged, published, or eligible for HAC-98.

## v2 candidate

- Repository: `workspace-json/codex-demo-fixture`
- Local branch: `fixture-v2-reconstructed`, based on `main` commit
  `366acf572e4fa943109d1307e19faeeecafb7921`.
- Packet commit: `4ee7ed779de9e33f90b5302aa52a141e5f415429`.
- Local-only annotated tag: `fixture-v2`.
- Workspace artifact: `.agents/workspace.json`.
- Workspace SHA-256:
  `3dc5ebe2b82e5d6e8b7eae226554e4724cf41fec6f7d8c9d0095c51ac3f6e871`.
- Node runtime: `v22.19.0`; focused command: `npm test`.

## Re-executed partner evidence

| Commit | State | Observed result |
| --- | --- | --- |
| `736887631fc8f411a8444de75ec9e10d1a4c8e7d` | Route-only money-object migration | Exit 1. Legacy session receives an object; USD becomes `$NaN` and JPY becomes USD/$NaN. |
| `57c5b1f90d890790bd7eb7a0ecba1c6bfed1af43` | Route plus session, legacy formatter | Exit 1. Formatter fails with `Unsupported currency: undefined`. |
| `d29d0e195acffb92f4ea880c08f7ca715d3f1a07` | Route, session, and formatter updated | Exit 0; both focused USD and JPY tests pass. |

Full raw TAP output, command, Node version, exit status, and output hash are in
the candidate fixture's `evidence/` directory. `scripts/regenerate-v2-proof.mjs`
re-executes the three commits in detached worktrees and regenerates the packet.

## History boundary

`fixture-v1`, including commits `90eee28` and `5707194`, remains unchanged and
is cited only as the superseded route-regression experiment. v2 is a separate,
append-only experiment; no v1 evidence is used in its artifact or README.

## Remaining gates

- Reviewer cycle 1 BLOCKed on unsupported HAC-96 prompt/model assertions; the
  candidate removed them. Reviewer cycle 2 PASSed with no blocking findings.
- Review the candidate before any remote branch, tag, merge, or publication
  action. No such decision is implied by this document.
- HAC-96 must still run and preserve three identical unprotected Codex trials
  with model/release/settings and omission rate.
- HAC-98 remains unauthorized until reviewer cycle 2 passes on v2.
