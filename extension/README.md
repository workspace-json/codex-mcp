# workspace.json — Codex change intelligence

Surfaces the repository evidence recorded in your local `.agents/workspace.json` at the moment you are changing code:

- **Explorer decorations** on files with recorded fragility, with the evidence claim on hover.
- A **current-change** view that names the evidenced co-change partners a change is leaving out.
- A synchronized **status item** reflecting the same assessment when the view is collapsed.
- **Receipt-backed advisory review** — reviewer output is shown only from a persisted receipt, with its model, scope, and freshness. A review is advisory and never a safety certification.

Everything is read from your local `.agents/workspace.json`. The extension makes **no network calls and sends no telemetry**.

## Install

The recommended path is the package installer, which handles the `code` CLI, idempotency, and the reload prompt for you:

```bash
npx -y @workspacejson/codex-mcp install --with-extension
```

To install a pinned VSIX by hand (offline, or a release artifact):

```bash
code --install-extension workspacejson-codex-decorations-<version>.vsix
```

VS Code Stable is the supported target. See the [main README](https://github.com/workspace-json/codex-mcp#installation) for the full MCP + hook + extension install journey.

## Build from source

```bash
npm ci
npm run package   # produces workspacejson-codex-decorations-<version>.vsix
```

Apache-2.0.
