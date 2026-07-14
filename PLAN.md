# Build Week implementation plan

Baseline marker: `43eb423` (`chore: mark Build Week implementation baseline`).

## Current critical path

1. Freeze and verify the existing checkout fixture (HAC-96).
2. Land and reverify correctness fixes: HAC-109, HAC-129, HAC-130, HAC-131.
3. Stabilize packaging and CI: HAC-110, HAC-114, HAC-100, HAC-91.
4. Run the clean-install and teardown audit (HAC-106).
5. Capture baseline and protected behavior evidence (HAC-97, HAC-98).
6. Invoke the read-only GPT-5.6 adversarial reviewer in the demonstrated flow
   (HAC-136).
7. Produce the under-three-minute demo and judge-facing assets, then run the cold
   judge journey and final assembly (HAC-121, HAC-120, HAC-122, HAC-124, HAC-107).

Do not capture final evidence while HAC-129, HAC-130, or HAC-131 is open. Do not
let reviewer output become enforcement input.

## Acceptance for this implementation session

- Project guidance and runbook are sufficient for a fresh Codex thread.
- The project configuration starts the MCP server, never the installer.
- Missing or malformed workspace intelligence warns explicitly and fails open.
- Both text and structured MCP responses are bounded without dropping the primary
  denial reason.
- The GPT-5.6 reviewer is project-scoped, read-only, visible, and invoked in the
  proof workflow.
- `npm run prepublishOnly` passes from a clean checkout.
- Adversarial review returns no unresolved BLOCK finding.

## Human gates

Q approves the frozen proof fixture, public claims, final evidence tiers, narration,
credentials/settings, design hierarchy, merges of critical fixes, and the final
Devpost submission. Run `/feedback` again after the implementation is complete;
the earlier Session ID is provisional.
