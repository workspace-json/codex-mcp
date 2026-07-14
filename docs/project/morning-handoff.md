# Morning handoff — HAC-159 v2 fixture reconstruction

## Completed locally

- Reconstructed v2 append-only from `workspace-json/codex-demo-fixture` main
  `366acf572e4fa943109d1307e19faeeecafb7921`; v1 history and tag remain intact.
- Candidate branch: `fixture-v2-reconstructed`; packet commit:
  `4ee7ed779de9e33f90b5302aa52a141e5f415429`.
- Local `fixture-v2` tag now records the new packet and workspace SHA-256
  `3dc5ebe2b82e5d6e8b7eae226554e4724cf41fec6f7d8c9d0095c51ac3f6e871`.
- Freshly executed evidence:
  - route-only `7368876` → exit 1 / session-contract `$NaN` failure;
  - route+session `57c5b1f` → exit 1 / formatter `Unsupported currency: undefined`;
  - complete `d29d0e1` → exit 0 / both focused tests pass.

## Do not do

- Do not rebase, rewrite, or alter `fixture-v1`, `90eee28`, or `5707194`.
- Do not push, merge, publish, or call this candidate frozen/public proof.
- Do not start HAC-98. Reviewer cycle 2 has passed, but HAC-96 still must run
  and a separate remote-review decision is required first.

## Next execution

1. Review the resulting local candidate, then decide separately whether to open
   a PR; no push, merge, tag publication, or release is authorized yet.
2. After an approved remote-review decision, run HAC-96's three identical
   unprotected trials.
