<br />

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/workspace-json-codex-lockup-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/workspace-json-codex-lockup-light.png">
    <img alt="workspace.json / Codex" src="assets/workspace-json-codex-lockup-dark.png" width="560">
  </picture>
</p>

<br />

<p align="center"><code>@workspacejson/codex-mcp</code></p>

<p align="center">
  <a href="https://github.com/workspace-json/codex-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/workspace-json/codex-mcp/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node >=20" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white">
  <img alt="License Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue">
</p>

<p align="center">Portable repository history helps Codex recognize fragile files and missing co-change partners before a supported edit lands.</p>

<p align="center">MCP supplies context. A deterministic hook enforces evidenced omissions. A read-only GPT-5.6 reviewer challenges the completed change.</p>

<p align="center"><sub>Runs locally over stdio and does not upload repository contents. Initial package installation may contact npm.</sub></p>

## See it in 30 seconds

**Task:** Update the checkout route.

Without `workspace.json`: Codex proposes one file.

With `workspace.json`: the hook identifies two evidenced partners and blocks the incomplete patch.

Result: Codex revises the changeset before the edit lands.

## Installation

workspace.json for Codex has three surfaces. Each installs with one command and is testable on its own — no build step, nothing leaves your machine at runtime.

### 1. Codex plugin — tools + pre-edit enforcement (recommended)

One command writes the MCP server and the pre-edit hook into your Codex config:

```bash
npx @workspacejson/codex-mcp install --with-hook
```

This is idempotent (safe to re-run) and stays scoped to the current repo's `.codex/` directory: it writes the MCP and hook blocks into `.codex/config.toml`, the reviewer config into `.codex/agents/`, and a stable runtime copy into `.codex/workspacejson-codex-mcp/`. It never touches `~/.codex`. Restart Codex, then run `/mcp` in the TUI to confirm `workspacejson` is connected.

Prefer to wire it yourself? Add this to `.codex/config.toml` (project) or `~/.codex/config.toml` (global):

```toml
[mcp_servers.workspacejson]
command = "npx"
args = ["-y", "@workspacejson/codex-mcp", "server"]
# Optional: point at a specific file or search root.
# env = { WORKSPACE_JSON_PATH = "/abs/path/.agents/workspace.json" }
```

The plugin bundles a `PreToolUse` hook that checks the change before an edit lands; the `--with-hook` installer writes that stanza for you. Without the hook you still get the read tools, but not deterministic enforcement.

To remove only the ownership-marked MCP, hook, reviewer, and stable runtime copy this installer wrote, leaving unrelated Codex settings untouched:

```bash
npx @workspacejson/codex-mcp uninstall
```

### 2. CI / repo-native check — no editor required

The same logic runs as a plain command, so it works in CI or from any shell:

```bash
git diff --name-only | npx @workspacejson/codex-mcp check --paths-stdin
```

Exit code 2 means a fragile change is missing a co-change partner; the reason prints with its evidence. Drop it into a GitHub Action to gate pull requests the same way the hook gates edits.

### 3. Editor decorations — VS Code / Cursor (optional)

Install the packaged extension from the release `.vsix`:

```bash
# VS Code
code --install-extension workspacejson-codex-<version>.vsix

# Cursor
cursor --install-extension workspacejson-codex-<version>.vsix
```

Fragile files are flagged in the Explorer with their tier and evidence on hover. The extension reads the same local `.agents/workspace.json`; it makes no network calls.

### Verify in two minutes

From a repo that has a committed `.agents/workspace.json`:

1. In Codex, ask it to edit a file the workspace flags as fragile.
2. Watch the hook refuse the patch, citing the recorded evidence and the co-change partner the change left out.
3. Ask Codex to include the partner and retry — the edit proceeds.

No configuration beyond step 1 above. The `example/` fixture in this repo reproduces the exact denial shown in the demo.

## How it works

Evidence, action, and challenge are three separate planes with different authority: `workspace.json` is descriptive history, the MCP tools and deterministic hook are mechanical enforcement on supported edits, and the read-only GPT-5.6 reviewer is advisory. The reviewer never controls the hook, and a `PASS` verdict is not a safety certification.

Full derivation rules for evidence tiers (`ASSERTED`/`OBSERVED`/`VERIFIED`), the hook's fail-open behavior, and the GPT-5.6 reviewer's scope live in [`docs/how-it-works.md`](docs/how-it-works.md).

## Tools

All are read-only and operate on the local `workspace.json`: `workspace_get_file_context`, `workspace_get_cochange_partners`, `workspace_list_fragile_files`, and `workspace_assess_change`. Full reference in [`docs/tools.md`](docs/tools.md).

## The `workspace.json` shape it reads

This server reads a tolerant superset of the [workspace.json standard](https://workspacejson.dev): `manual.fragileFiles`, `manual.coChangePatterns`, `generated.fileIndex`, and `generated.frameworkManifest`. Field-level detail and the normalizer's provenance note are in [`docs/workspace-contract.md`](docs/workspace-contract.md).

## Develop

```bash
npm install
npm run build     # tsc, strict
npm run smoke     # spawns the server over stdio and drives it via a real MCP client
```

What the smoke test actually exercises is documented in [`docs/development.md`](docs/development.md).

## For the OpenAI Build Week submission

This project was built during OpenAI Build Week as a new Codex integration for the open `workspace.json` standard; the standard itself is pre-existing open-source work used here as a dependency. Full disclosure of what was authored in-window versus pre-existing is in [`docs/build-week.md`](docs/build-week.md).

## Verification status

Claims about this project are tagged with the same honest evidence tiers the tool itself uses. The full breakdown of what's `VERIFIED` (smoke suite, real-Codex hook denial) versus asserted is in [`docs/verification.md`](docs/verification.md).

## Current limitations

- Enforcement currently covers Codex `apply_patch`.
- Other edit mechanisms may receive context without deterministic blocking.
- Missing or malformed `workspace.json` fails open with an explicit unavailable warning.
- Stale evidence is not treated as proof of current risk.
- `fragile:false` means the file has no recorded fragility, not that it is verified safe.
- This does not replace tests, review, or repository instructions.

## Learn more

- [How it works](docs/how-it-works.md) — evidence tiers, hook enforcement, GPT-5.6 reviewer
- [Tools](docs/tools.md) — full MCP tool reference
- [The workspace.json contract](docs/workspace-contract.md) — fields consumed and normalization
- [Verification](docs/verification.md) — what's been verified and how
- [Build Week disclosure](docs/build-week.md) — what was authored in-window
- [Development](docs/development.md) — contributor commands
- [Clean-install audit](docs/clean-install-audit.md) · [Fixture verification](docs/fixture-verification.md)

## License

Apache-2.0
