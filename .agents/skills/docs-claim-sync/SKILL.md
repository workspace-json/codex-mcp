---
name: docs-claim-sync
description: Compare public documentation and launch copy against shipped contracts and preserved evidence before editing claims. Use for README, implementation page, Devpost, deck, npm metadata, video script, blog, or social copy changes.
---

# Docs Claim Sync

Produce a drift report before proposing edits. Never strengthen wording without
evidence-owner approval.

## Canonical inputs

Use these repository paths when present:

- Claim matrix: `docs/claim-matrix.md`
- HAC-98 evidence packet: `docs/evidence/hac-98/`
- Fixture provenance: `docs/fixture-verification.md`
- Install/teardown evidence: `docs/clean-install-audit.md`

Also inspect the shipped tool names/descriptions, package metadata, install and
uninstall commands, supported edit mechanisms, and runtime privacy behavior.
Discover public surfaces with `rg --files` and include external site, Devpost,
deck, video, blog, npm, or social artifacts explicitly supplied by the user.

If the claim matrix or HAC-98 packet is absent, mark it unavailable and prohibit
new VERIFIED or stronger behavior claims. Do not infer a tier from text labels;
derive `ASSERTED`, `OBSERVED`, or `VERIFIED` only from the underlying evidence.
Treat documentation, contracts, and matrix wording as claims, not evidence
records: without an underlying evidence record the derived tier is `ASSERTED`.

## Workflow

1. Inventory every public surface and record missing or inaccessible ones.
2. Extract material claims about names, tool outputs, install paths, supported
   edits, privacy, evidence tiers, package/repository identity, and limitations.
3. Map each claim to a shipped contract and preserved evidence source.
4. Compare wording across surfaces and identify unsupported strengthening,
   stale names/commands, or omitted limitations.
5. Return the drift report before editing. Make edits only after the report and
   only within the user-approved claim level.

## Required output

For each material claim report: surface/location, current wording, canonical
wording, evidence source, derived tier, allowed surfaces, prohibited stronger
wording, owner/approval needed, and proposed correction. Finish with unavailable
inputs, files that would change, and explicit stop conditions.

## Stop behavior

Stop before editing when a correction would strengthen a claim, change evidence
semantics, invent missing evidence, alter the frozen fixture, or require an
unavailable external surface. Synthetic drift tests must use disposable copies
and must not mutate canonical public artifacts.
