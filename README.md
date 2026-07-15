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

That gives you MCP context **plus** the deterministic pre-edit hook — the enforcement shown in the 30-second demo above. It's idempotent, scoped to this repo's `.codex/` directory, and never touches `~/.codex`. Restart Codex, then run `/mcp` to confirm `workspacejson` is connected.

**Add surfaces as you want them.** Each flag is additive and asks for exactly the consent it needs — nothing is installed silently:

| Command | Adds | Touches |
| --- | --- | --- |
| `install` | MCP context (read tools) + optional GPT-5.6 reviewer | this repo's `.codex/` |
| `install --with-hook` | + deterministic pre-edit hook | this repo's `.codex/` |
| `install --with-extension` | + VS Code editor surface | your global VS Code (explicit consent) |
| `install --full` | the hook **and** the extension | both |

**Uninstall** mirrors that consent. `npx @workspacejson/codex-mcp uninstall` removes only what this repo owns — the MCP block, hook, and runtime — and **leaves your global VS Code extension in place**. To remove the editor extension too, ask for it explicitly: `npx @workspacejson/codex-mcp uninstall --with-extension`.

<details>
<summary>MCP-only setup, CI check, the VS Code surface, and manual verification</summary>

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

### VS Code editor surface (optional)

Let the installer handle the `code` CLI, idempotency, and the reload prompt for you:

```bash
npx @workspacejson/codex-mcp install --with-extension
```

This installs the `workspace-json.workspacejson-codex-decorations` extension: Explorer decorations on fragile files, a **current-change** view, a synchronized status item, and receipt-backed advisory review — all read from your local `.agents/workspace.json`, with no network calls and no telemetry.

The installer targets **VS Code Stable** only. If the `code` CLI isn't on your PATH it reports `UNAVAILABLE` with a one-line fix and leaves your MCP/hook install untouched — it never silently targets Insiders, Cursor, a remote, or a container. To aim it at a different editor's CLI deliberately, set `WORKSPACEJSON_CODE_CLI` (e.g. `cursor`) and rerun.

Building from a checkout of this repo? Produce the VSIX first, then install:

```bash
npm run build:extension
npx @workspacejson/codex-mcp install --with-extension
```

Prefer to install a pinned VSIX by hand (offline, or a release artifact)?

```bash
code --install-extension workspacejson-codex-decorations-<version>.vsix
```

Demo and fixture repos may recommend the exact extension ID through `.vscode/extensions.json`; that's discovery only and never installs anything on its own.

### Verify in two minutes

From a repo that has a committed `.agents/workspace.json`:

1. In Codex, ask it to edit a file the workspace flags as fragile.
2. Watch the hook refuse the patch, citing the recorded evidence and the co-change partner the change left out.
3. Ask Codex to include the partner and retry — the edit proceeds.

No configuration beyond step 1 above. The `example/` fixture in this repo reproduces the exact denial shown in the demo.

</details>

## How it works

MCP supplies context. A deterministic hook enforces evidenced omissions. An optional, direct read-only GPT-5.6 API review challenges a supplied completed diff and preserves its request/response receipt locally. The reviewer never controls the hook, and a `PASS` verdict is not a safety certification.

Full derivation rules for evidence tiers (`ASSERTED`/`OBSERVED`/`VERIFIED`), the hook's fail-open behavior, and the GPT-5.6 reviewer's scope live in [`docs/how-it-works.md`](docs/how-it-works.md).

## Operational guarantees

- Missing evidence never becomes a safety approval.
- Malformed evidence never crashes the edit loop.
- Reviewer output never controls deterministic enforcement.
- Installation never overwrites unmanaged configuration.
- Uninstall removes only owned artifacts.
- The editor extension installs only with explicit `--with-extension` consent.
- Every `VERIFIED` claim maps to a reproducible command.

Each is checkable, not asserted: run `npm run verify` from a clean clone to reproduce the gate this repository's own CI runs, or read the source citations in [`docs/operational-guarantees.md`](docs/operational-guarantees.md). See [`docs/failure-modes.md`](docs/failure-modes.md) for the behavior behind each guarantee under missing, malformed, or unavailable input.

## Trust boundary

The MCP and deterministic hook run locally over stdio and do not upload repository contents. Initial package installation may contact npm. The optional `review` command sends only the diff you explicitly supply to a configured API provider: OpenAI (`OPENAI_API_KEY`) or OpenRouter (`OPENROUTER_API_KEY`). When both keys exist, set `WORKSPACEJSON_REVIEWER_PROVIDER` to `openai` or `openrouter`; an explicit `WORKSPACEJSON_REVIEWER_BASE_URL` also selects OpenRouter. It uses `store: false` with OpenAI and preserves a local request/response receipt that identifies the provider and model. Do not supply diffs containing secrets.

## Current limitations

- Enforcement currently covers Codex `apply_patch`.
- Other edit mechanisms may receive context without deterministic blocking.
- Missing or malformed `workspace.json` fails open with an explicit unavailable warning.
- Stale evidence is not treated as proof of current risk.
- `fragile:false` means the file has no recorded fragility, not that it is verified safe.
- This does not replace tests, review, or repository instructions.

## Learn more

- [How it works](docs/how-it-works.md) — evidence tiers, hook enforcement, GPT-5.6 reviewer
- [Operational guarantees](docs/operational-guarantees.md) — the seven promises above, with source citations
- [Failure modes](docs/failure-modes.md) — behavior under missing, malformed, or unavailable input
- [Tools](docs/tools.md) — full MCP tool reference (`workspace_get_file_context`, `workspace_get_cochange_partners`, `workspace_list_fragile_files`, `workspace_assess_change`)
- [The workspace.json contract](docs/workspace-contract.md) — fields consumed and normalization
- [Verification](docs/verification.md) — what's been verified and how
- [Build Week disclosure](docs/submission/build-week.md) — what was authored in-window
- [Development](docs/development.md) — build, test, and smoke-suite commands
- [Clean-install audit](docs/clean-install-audit.md) · [Fixture verification](docs/fixture-verification.md)

## License

Apache-2.0
