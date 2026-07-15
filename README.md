<br />

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/workspace-json-codex-lockup-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/workspace-json-codex-lockup-light.png">
    <img alt="workspace.json / Codex" src="assets/workspace-json-codex-lockup-dark.png" width="620">
  </picture>
</p>

<br />

<p align="center"><strong>Portable repository history that changes Codex's plan before an evidenced risky edit lands.</strong></p>

<p align="center"><code>@workspacejson/codex-mcp</code></p>

<p align="center">
  <a href="https://github.com/workspace-json/codex-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/workspace-json/codex-mcp/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue">
</p>

## See it in 30 seconds

| | |
| --- | --- |
| Task | Update the checkout route |
| Without `workspace.json` | Codex proposes one file |
| With `workspace.json` | The hook identifies two evidenced partners |
| Enforcement | The incomplete patch is denied |
| Outcome | Codex revises the changeset before the edit lands |

## Installation

```bash
npx @workspacejson/codex-mcp install --with-hook
```

Installs:
- MCP context
- deterministic pre-edit hook
- read-only GPT-5.6 reviewer

Idempotent, scoped to this repo's `.codex/` directory, never touches `~/.codex`. Restart Codex, then run `/mcp` to confirm `workspacejson` is connected. Remove everything it wrote with `npx @workspacejson/codex-mcp uninstall`.

<details>
<summary>MCP-only setup, CI check, editor decorations, and manual verification</summary>

### Wire the MCP server yourself

Add this to `.codex/config.toml` (project) or `~/.codex/config.toml` (global):

```toml
[mcp_servers.workspacejson]
command = "npx"
args = ["-y", "@workspacejson/codex-mcp", "server"]
# Optional: point at a specific file or search root.
# env = { WORKSPACE_JSON_PATH = "/abs/path/.agents/workspace.json" }
```

Without the hook you still get the read tools, but not deterministic enforcement.

### CI / repo-native check — no editor required

```bash
git diff --name-only | node hooks/pre-edit-check.mjs --paths-stdin
```

Exit code 2 means a fragile change is missing a co-change partner; the reason prints with its evidence. Drop it into a GitHub Action to gate pull requests the same way the hook gates edits.

### Editor decorations — VS Code / Cursor (optional)

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

</details>

## How it works

MCP supplies context. A deterministic hook enforces evidenced omissions. A read-only GPT-5.6 reviewer challenges the completed change. The reviewer never controls the hook, and a `PASS` verdict is not a safety certification.

Full derivation rules for evidence tiers (`ASSERTED`/`OBSERVED`/`VERIFIED`), the hook's fail-open behavior, and the GPT-5.6 reviewer's scope live in [`docs/how-it-works.md`](docs/how-it-works.md).

## Operational guarantees

- Missing evidence never becomes a safety approval.
- Malformed evidence never crashes the edit loop.
- Reviewer output never controls deterministic enforcement.
- Installation never overwrites unmanaged configuration.
- Uninstall removes only owned artifacts.
- Every `VERIFIED` claim maps to a reproducible command.

Each is checkable, not asserted: run `npm run verify` from a clean clone to reproduce the gate this repository's own CI runs, or read the source citations in [`docs/operational-guarantees.md`](docs/operational-guarantees.md). See [`docs/failure-modes.md`](docs/failure-modes.md) for the behavior behind each guarantee under missing, malformed, or unavailable input.

## Trust boundary

Runs locally over stdio and does not upload repository contents. Initial package installation may contact npm.

## Current limitations

- Enforcement currently covers Codex `apply_patch`.
- Other edit mechanisms may receive context without deterministic blocking.
- Missing or malformed `workspace.json` fails open with an explicit unavailable warning.
- Stale evidence is not treated as proof of current risk.
- `fragile:false` means the file has no recorded fragility, not that it is verified safe.
- This does not replace tests, review, or repository instructions.

## Learn more

- [How it works](docs/how-it-works.md) — evidence tiers, hook enforcement, GPT-5.6 reviewer
- [Operational guarantees](docs/operational-guarantees.md) — the six promises above, with source citations
- [Failure modes](docs/failure-modes.md) — behavior under missing, malformed, or unavailable input
- [Tools](docs/tools.md) — full MCP tool reference (`workspace_get_file_context`, `workspace_get_cochange_partners`, `workspace_list_fragile_files`, `workspace_assess_change`)
- [The workspace.json contract](docs/workspace-contract.md) — fields consumed and normalization
- [Verification](docs/verification.md) — what's been verified and how
- [Build Week disclosure](docs/submission/build-week.md) — what was authored in-window
- [Development](docs/development.md) — build, test, and smoke-suite commands
- [Clean-install audit](docs/clean-install-audit.md) · [Fixture verification](docs/fixture-verification.md)

## License

Apache-2.0
