# Checkout fixture verification

Status: artifact verified; external checkout baseline blocked.

## Committed artifact

- Repository: `https://github.com/workspace-json/codex-mcp`
- Artifact: `fixture/.agents/workspace.json`
- Introduced by commit: `687089e`
- Git blob: `928a0fcd07d2aad9a8f63ed444de621ee3ae9e2a`
- SHA-256:
  `54d9862dfabcc74fb6e3bc1ca8de5f755418989d12eafc1b91caf444b1d02428`
- Spec version recorded by the artifact: `0.4`
- Framework context: Node, Next, Vitest

No generator command was run during this session. `git status` reports no change to
the committed artifact.

## Proof relationship

- Primary path: `src/routes/checkout.ts`
- Partners: `src/auth/session.ts`, `src/lib/format.ts`
- Fragility reason: payment edge cases
- Evidence: `revert d4e5f6 (payment rounding)` and
  `incident 2026-03-02: double-charge on retry`

Integrated smoke and packed-artifact runs establish:

- checkout alone → exit 2 / deterministic deny naming both partners and evidence;
- checkout + session + format → warning context and edit proceeds;
- reset for the committed artifact →
  `git restore -- fixture/.agents/workspace.json`.

## Open HAC-96 gate

This repository contains the intelligence artifact but not the checkout source files
or the source repository/commit whose history produced `d4e5f6`. Therefore the
required three identical unprotected Codex runs, incomplete/corrected source patches,
targeted application tests, and source reset command cannot be reproduced honestly
from this checkout.

To close HAC-96, Q must identify or approve the external checkout repository and
exact commit containing the three paths. Then run the immutable prompt three times
with identical model/settings, preserve all outputs, and record the omission rate.
