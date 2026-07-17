# Changelog

## Unreleased

### Added

- Marketplace metadata: keywords, gallery banner, badges, homepage, pricing, preview flag, and author.
- This `CHANGELOG.md`, bundled into the VSIX for the Marketplace's Changelog tab.
- `SUPPORT.md` — a plain support-links doc, kept out of the packaged VSIX via `.vscodeignore` (it isn't at a location GitHub recognizes as a community health file, so it isn't wired into any GitHub or Marketplace flow yet — it exists for a human to link to directly).

## 0.1.0

### Added

- Explorer decorations for files by their role in the current change (denied, omitted partner, included).
- Activity Bar view showing the deterministic decision, denied reasons, and omitted co-change partners.
- Status-bar heartbeat mirroring the current decision.
- Receipt-backed advisory review with GPT-5.6 verdict rendering.
- Commands: Show Current Change, Inspect Evidence, Run Verification, Run Advisory Review, Inspect Review Receipt, Open Intelligence File, Getting Started.
- Walkthrough with four guided steps.
