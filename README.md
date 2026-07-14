# workspace.json for Codex

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/workspace-json-codex-lockup-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/workspace-json-codex-lockup-light.png">
  <img alt="workspace.json / Codex" src="assets/workspace-json-codex-lockup-dark.png" width="480">
</picture>

`@workspacejson/codex-mcp`

[![CI](https://github.com/workspace-json/codex-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/workspace-json/codex-mcp/actions/workflows/ci.yml)

An MCP server that gives OpenAI Codex the one thing it structurally cannot derive from the current source tree: **behavioral history**. It reads a local [`workspace.json`](https://workspacejson.dev) and exposes, as Codex tools, which files are **fragile** (historically error-prone / high blast radius) and which files **co-change** (tend to be edited together).

Codex reads the same tree you do. What it can't see is that `src/db/client.ts` has been reverted three times, or that touching the checkout route almost always means touching the session module too. That history lives in `workspace.json`. This server hands it to Codex, and via the MCP `instructions` field, tells Codex to consult it *before* editing a file rather than only when asked.

At runtime, the server operates locally over stdio and does not upload repository contents. Initial package installation may contact npm.

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

<!--
==========================================================================
INTERNAL — REMOVE BEFORE SHIP. Gate dependencies for each command above:

Path 1:
  - `npx @workspacejson/codex-mcp ...` requires the package PUBLISHED to npm
    (release gate). Until published, judges use a local clone: swap `npx ...`
    for `node ./dist/index.js server` and run `node scripts/install.mjs
    --with-hook`.
  - `install --with-hook` = HAC-91 R-C5-1/R-C5-2. Must be idempotent (clobber
    guard) and must NOT run on connect (see HAC-129 — the committed config's
    server arg is the fix).
  - The manual config's `"server"` arg is HAC-129's fix. Do NOT ship the
    args without it or opening the repo launches the installer.

Path 2:
  - `check --paths-stdin` = the hook's CLI mode (HAC-90 / hooks/pre-edit-check.mjs
    already supports --paths-stdin). Confirm the bin exposes `check` as a
    subcommand, or document `node hooks/pre-edit-check.mjs --paths-stdin`.

Path 3:
  - The .vsix does not exist yet (HAC-136 R-9, CONDITIONAL — build only if the
    P0 trio + subagent land with buffer). If the extension is cut, delete this
    entire section 3 and the "decorations" line from Verify.
  - <version> filename is set by the extension package.json.

Verify block:
  - The "watch it refuse / cite evidence" flow depends on the frozen fixture
    (HAC-96) and captured behavior (HAC-98). Do not publish the exact cited
    strings until those are green; keep this description behavioral, not
    quoting a specific SHA, until frozen.
==========================================================================
-->

## Evidence tiers (the part that is different)

Every fragility signal carries a tier, derived **mechanically** by this package from the evidence attached to it. Producers (humans, tools, agents) record evidence; they never record a tier or a confidence value, and any such field in the artifact is ignored and re-derived:

| Tier | Meaning | Derivation |
| --- | --- | --- |
| `ASSERTED` | Claimed, no evidence recorded | zero evidence records |
| `OBSERVED` | Something was seen and written down | at least one evidence record (`{claim, command?, output?}` or bare observation) |
| `VERIFIED` | A green we watched | at least one evidence triple whose read-only command was re-run locally and reproduced its recorded output (`--verify` mode; whitelisted `git log/show/diff/grep/rev-parse/status` only) |

Tier drives enforcement strength, mechanically: an evidenced-fragile file whose recorded co-change partners are absent from the changeset is **denied**; evidenced fragility with partners covered **warns**; `ASSERTED` fragility only **annotates**. And deliberately: this system can justify a block or a warning, but it structurally never emits a safety approval. Absence of recorded risk is reported as absence, never as "safe" — the evidence class that would certify safety is exactly the class that cannot be verified by read-only re-run.

## Hooks (deterministic enforcement)

`hooks/pre-edit-check.mjs` is a PreToolUse hook for Codex's `apply_patch`: it parses the touched paths from the patch, assesses the whole changeset, and denies or warns before the edit lands. It is also the repo-native fallback and CI consumer:

```bash
git diff --name-only | node hooks/pre-edit-check.mjs --paths-stdin
node hooks/pre-edit-check.mjs --paths src/routes/checkout.ts
```

The hook fails open on missing or malformed intelligence and never crashes the edit loop. Fail-open is explicit: Codex receives an `unavailable` warning explaining that no fragility/co-change determination was made and how to validate or locate the artifact. A block is triggered by an **evidenced partner omission**: a co-change relationship recorded in `workspace.json` is absent from the proposed patch. It does not mean the partner is universally required for every semantic change.

## GPT-5.6 adversarial reviewer

The full installer registers a project-scoped `adversarial_reviewer` custom agent pinned to GPT-5.6 with high reasoning and a read-only sandbox. Invoke it after a logical change and before commit or demonstration. It returns a visible, attributed `BLOCK` or `PASS` verdict with reproduced evidence and explicit review gaps.

The reviewer is advisory. It cannot write files and its verdict never changes the deterministic hook decision. `PASS` means no blocking issue was found in the reviewed scope; it is not a safety certification. Missing or malformed workspace evidence is reported as `UNKNOWN`/`UNAVAILABLE`, not guessed away.

## Tools

All are read-only and operate on the local `workspace.json`.

- **`workspace_get_file_context(path)`** — the primary call. Returns fragility (with reason/score/evidence when present) and co-change partners for one file. Call it before editing. Returns `fragile:false` with an empty partner list when a file has no recorded history: that means **no recorded risk**, not **verified safe**. The system never issues a safety approval; it only reports whether the evidence it holds supports a concern.
- **`workspace_get_cochange_partners(path)`** — the files that historically change with this one. Call it after an edit to catch related updates.
- **`workspace_list_fragile_files(limit?)`** — all fragile files, most fragile first, plus bounded primitive framework context from `generated.frameworkManifest`. Orientation at the start of a task.
- **`workspace_assess_change(paths[])`** — evaluate a whole changeset; returns the mechanical `deny`/`warn`/`annotate`/`none` decision with per-file assessments. The MCP twin of the hook.

## The `workspace.json` shape it reads

This server reads a tolerant superset of the [workspace.json standard](https://workspacejson.dev). The fields consumed:

| Field | Used for |
| --- | --- |
| `manual.fragileFiles` | fragility signal (accepts `string[]` or `{ path, reason, score, evidence }[]`) |
| `manual.coChangePatterns` | co-change groups (accepts `{ files: [] }[]`, `string[][]`, or adjacency map) |
| `generated.fileIndex` | whether a queried path is indexed |
| `generated.frameworkManifest` | framework context |

> **Provenance note:** the normalizer in `src/services/workspace.ts` is the single place that touches raw file shape. Field names above track the standard's `v0.x` line; if the canonical schema in `@workspacejson/spec` differs, adjust the normalizer only. The rest of the server depends on the normalized model in `src/types.ts`, never the raw file.

## Develop

```bash
npm install
npm run build     # tsc, strict
npm run smoke     # spawns the server over stdio and drives it via a real MCP client
```

The smoke test (`scripts/smoke.mjs`) exercises the protocol end to end: initialize, `tools/list`, all four tools, absolute-vs-relative path matching, unknown-file behavior, bounded text and structured responses, explicit fail-open warnings, hook decisions, and opt-in live verification.

## For the OpenAI Build Week submission

> This project was built during OpenAI Build Week as a new Codex integration for the open `workspace.json` standard. The `workspace.json` standard and its generator (`@workspacejson/cli`) are pre-existing open-source work, used here as a dependency the same way any participant could depend on it. The Build Week contribution is `@workspacejson/codex-mcp`: the MCP server, its tool surface, deterministic hook, packaging, and GPT-5.6 read-only adversarial reviewer, all authored or integrated in-window and contained in this repository.

Codex accelerated implementation, regression-test generation, packaging validation, and adversarial review. Human decisions control the product boundary: deterministic evidence remains the enforcement plane; GPT-5.6 performs visible semantic risk review without write or enforcement authority; Q approves the fixture, claims, evidence tiers, design, narration, and submission.

## Verification status (honest tiers on our own claims)

VERIFIED (the smoke suite drives the built server over stdio and the hook via stdin): protocol handshake and instructions, all four tools, tier derivation for ASSERTED/OBSERVED/VERIFIED (the VERIFIED tier is opt-in via `--verify` / `WJSON_VERIFY=1`: it re-runs a whitelisted read-only `git` command and reproduces its recorded output, downgrading to OBSERVED when it does not — never on the hook hot path), the deny/warn/none enforcement matrix, evidence citation in deny reasons, META-102 exact-first path matching with absolute-path fallback and fuzzy-match rejection, bounded text and structured payloads, root-marker upward walk from a nested cwd, hook exit codes and JSON emission, and explicit fail-open warnings for missing, malformed, or unparseable inputs.

VERIFIED on real Codex 0.144.1 (2026-07-13): the installed plugin manifest loaded its `PreToolUse` hook; `hookSpecificOutput.permissionDecision: "deny"` plus exit code 2 blocked `apply_patch` under `WJSON_DENY_ALL=1`; unsetting it allowed a normal edit; the fixture denied a checkout-only edit with the recorded `revert d4e5f6` evidence and missing partners; and a single patch covering checkout, session, and format surfaced cautionary context and proceeded. The output contract and manifest remain isolated to single adapter points (`emitDecision()` in the hook; `.codex-plugin/plugin.json`).

## Current limitations

- Enforcement currently covers Codex `apply_patch`.
- Other edit mechanisms may receive context without deterministic blocking.
- Missing or malformed `workspace.json` fails open with an explicit unavailable warning.
- Stale evidence is not treated as proof of current risk.
- `fragile:false` means the file has no recorded fragility, not that it is verified safe.
- This does not replace tests, review, or repository instructions.

## License

Apache-2.0
