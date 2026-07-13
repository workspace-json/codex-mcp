# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CI workflow with build, smoke, and `npm pack --dry-run` verification.
- `test` script (`npm run build && npm run smoke`).
- `SECURITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.
- Full Apache License 2.0 text.
- Package metadata: repository, homepage, bugs, and keywords.
- README sections: "See it in 30 seconds", "Option 1: MCP context only", "Option 2: Full Codex plugin", and "Current limitations".

### Changed

- `package.json` `files` array now includes `dist`, `hooks`, `.codex-plugin`, `.mcp.json`, `README.md`, and `LICENSE` so the npm package contains the plugin manifest and hook assets.
- Plugin manifest `repository` updated from `workspace-json/codex-plugin` to `workspace-json/codex-mcp`.
- README network wording clarified to distinguish runtime stdio behavior from initial npm install.
- README `fragile:false` wording clarified to mean "no recorded risk", not "verified safe".
- Hook description now uses "evidenced partner omission" instead of implying universal correctness.

## [0.1.0] - 2026-07-13

### Added

- Initial MCP server for `@workspacejson/codex-mcp`.
- Four tools: `workspace_get_file_context`, `workspace_get_cochange_partners`, `workspace_list_fragile_files`, `workspace_assess_change`.
- PreToolUse hook for Codex `apply_patch`.
- Evidence-tier derivation (ASSERTED, OBSERVED, VERIFIED).
- Smoke suite with 24 checks.
- Real Codex 0.144.1 verification notes.
