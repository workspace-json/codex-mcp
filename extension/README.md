<p align="center">
  <img src="https://raw.githubusercontent.com/workspace-json/codex-mcp/main/assets/workspace-json-codex-lockup-dark.png" alt="workspace.json / Codex" width="700">
</p>

<p align="center"><strong>Repository evidence, at the moment you change code — in native VS Code surfaces, with no webview and no telemetry.</strong></p>

---

**workspace.json — Codex change intelligence** reads the evidence recorded in your local `.agents/workspace.json` and makes it actionable while you edit:

- **Explorer decorations** mark files by their role in the current change — the denied file, its omitted co-change partners, the ones you've already included — with the evidence claim on hover.
- A branded **workspace.json** view in the Activity Bar shows the **current change**: the deterministic decision, why it's denied, and exactly which evidenced partners are omitted.
- A synchronized **status-bar** heartbeat mirrors the same decision when the view is collapsed.
- **Receipt-backed advisory review** renders a GPT-5.6 verdict *only* from a persisted receipt — model, scope, freshness, and gaps — one click from the receipt itself.

## Two planes, kept separate

The whole point of the surface is a distinction you can see in one hover:

> **Deterministic decision: DENY** — 2 evidenced partners omitted
> **Advisory result: PASS within reviewed scope**

The rules said no. An independent model looked and found no additional blocker. **The block holds anyway.** Judgment and enforcement are separate planes: an advisory review can add signal, but it never lifts a deterministic decision, and `PASS` is scope-bounded — never a safety certification.

Everything is read from your local `.agents/workspace.json`. **No network calls. No telemetry.**

## Install

Recommended — the package installer handles the `code` CLI, idempotency, and the reload prompt:

```bash
npx -y @workspacejson/codex-mcp install --with-extension
```

Only VS Code Stable is targeted; it never silently installs into another editor. For the full MCP + deterministic hook + extension journey, see the [main repository](https://github.com/workspace-json/codex-mcp#installation).

Apache-2.0.
