# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.9] - 2026-07-21

### Fixed

- Narrowed README evidence and outcome wording to the recorded co-change mechanism, without implying a documented production incident or a guaranteed Codex revision.
- Clarified local extension rendering and saved receipts versus explicit provider-backed advisory review across the root README, extension metadata, extension README, and Getting Started walkthrough.

## [0.1.8] - 2026-07-21

### Fixed

- Bounded the evidenced-partner deny guidance: include the recorded partners, or stop and review the exception with a human; no approval bypass is implied.
- Distinguished the local two-partner fixture walkthrough from Billfold's separate one-partner provider-demo proof path.
- Corrected public wording for the hero, generator producer, network boundary, path coverage limits, and Billfold reproduction links.

## [0.1.5] - 2026-07-17

### Fixed

- Corrected judge-facing package references from `example/` to the tracked `fixture/`.
- Packaged the plugin manifest icon asset so its icon paths resolve from the npm tarball.
- Prepared the extension's staged advisory-review command to use `@workspacejson/codex-mcp`.
- `normalizeWorkspace()` and the extension's `parseSnapshot()` each misread one of the two shapes real producers emit for `generated.fileIndex` and `generated.frameworkManifest`; both now read either shape correctly instead of silently degrading.
- Regenerated the tracked demo fixture with the real, published `agents-audit@0.4.3 generate`, so it validates against the packaged `@workspacejson/spec` schema.

### Added

- CI workflow with build, smoke, and `npm pack --dry-run` verification.
- `test` script (`npm run build && npm run smoke`).
- `SECURITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.
- Full Apache License 2.0 text.
- Package metadata: repository, homepage, bugs, and keywords.
- README sections: "See it in 30 seconds", "Option 1: MCP context only", "Option 2: Full Codex plugin", and "Current limitations".
- Optional, direct, read-only GPT-5.6 API reviewer with local request/response receipts.
- Repository execution guidance and a tracked Build Week runbook.
- Structured-response bounding with deny-preservation regression coverage.
- Explicit fail-open warnings for missing, malformed, and unparseable workspace intelligence.

### Changed

- `package.json` `files` array includes the runtime, hook assets, plugin manifest, and installer; the optional reviewer is compiled into `dist` rather than installed as a custom Codex agent.
- Plugin manifest `repository` updated from `workspace-json/codex-plugin` to `workspace-json/codex-mcp`.
- README network wording clarified to distinguish runtime stdio behavior from initial npm install.
- README `fragile:false` wording clarified to mean "no recorded risk", not "verified safe".
- Hook description now uses "evidenced partner omission" instead of implying universal correctness.
- Project and help configuration now invoke the package's `server` subcommand instead of the installer.
- `workspace_list_fragile_files` now surfaces bounded primitive framework context.

## [0.1.0] - 2026-07-13

### Added

- Initial MCP server for `@workspacejson/codex-mcp`.
- Four tools: `workspace_get_file_context`, `workspace_get_cochange_partners`, `workspace_list_fragile_files`, `workspace_assess_change`.
- PreToolUse hook for Codex `apply_patch`.
- Evidence-tier derivation (ASSERTED, OBSERVED, VERIFIED).
- Smoke suite with 24 checks.
- Real Codex 0.144.1 verification notes.
