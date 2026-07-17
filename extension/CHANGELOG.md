# Changelog

## Unreleased

### Added

- Marketplace metadata: categories, keywords, gallery banner, badges, homepage, pricing, preview flag, and author.
- This `CHANGELOG.md`, bundled into the VSIX for the Marketplace's Changelog tab.
- `SUPPORT.md` — a GitHub community health file (intentionally excluded from the packaged VSIX via `.vscodeignore`; it drives GitHub's own issue-creation flow, not a Marketplace tab).

## 0.1.0

### Added

- Explorer decorations for files by their role in the current change (denied, omitted partner, included).
- Activity Bar view showing the deterministic decision, denied reasons, and omitted co-change partners.
- Status-bar heartbeat mirroring the current decision.
- Receipt-backed advisory review with GPT-5.6 verdict rendering.
- Commands: Show Current Change, Inspect Evidence, Run Verification, Run Advisory Review, Inspect Review Receipt, Open Intelligence File, Getting Started.
- Walkthrough with three guided steps.
