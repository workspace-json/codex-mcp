# @workspacejson/codex-mcp

An MCP server that gives OpenAI Codex the one thing it structurally cannot derive from the current source tree: **behavioral history**. It reads a local [`workspace.json`](https://workspacejson.dev) and exposes, as Codex tools, which files are **fragile** (historically error-prone / high blast radius) and which files **co-change** (tend to be edited together).

Codex reads the same tree you do. What it can't see is that `src/db/client.ts` has been reverted three times, or that touching the checkout route almost always means touching the session module too. That history lives in `workspace.json`. This server hands it to Codex, and via the MCP `instructions` field, tells Codex to consult it *before* editing a file rather than only when asked.

At runtime, the server operates locally over stdio and does not upload repository contents. Initial package installation may contact npm.

## See it in 30 seconds

**Task:** Update the checkout route.

Without `workspace.json`: Codex proposes one file.

With `workspace.json`: the hook identifies two evidenced partners and blocks the incomplete patch.

Result: Codex revises the changeset before the edit lands.

## Install & wire into Codex

### Option 1: MCP context only

Add the MCP server to Codex (`~/.codex/config.toml` global or `.codex/config.toml` project-scoped):

```toml
[mcp_servers.workspacejson]
command = "npx"
args = ["-y", "@workspacejson/codex-mcp", "server"]
# Optional: point at a specific file or search root.
# env = { WORKSPACE_JSON_PATH = "/abs/path/.agents/workspace.json" }
```

Restart Codex, then run `/mcp` in the TUI to confirm the server is connected. The server ships standing guidance in its MCP `instructions`; you can reinforce it in `AGENTS.md`:

```md
Before editing or creating a file, call workspace_get_file_context on the target
path to check fragility and co-change partners.
```

### Option 2: Full Codex plugin — MCP + deterministic hook

For deterministic enforcement, run the installer from the repo root:

```bash
npx -y @workspacejson/codex-mcp install --with-hook
# or, if you have the repo cloned:
node scripts/install.mjs --with-hook
```

This writes the MCP server block and a `PreToolUse` hook stanza into `.codex/config.toml` at the current repo root. Re-run the command at any time; it is idempotent and never duplicates the block.

You can also copy the bundled plugin assets manually into a Codex plugin directory:

```bash
cp -r node_modules/@workspacejson/codex-mcp/.codex-plugin ~/.codex/plugins/workspace-json
cp -r node_modules/@workspacejson/codex-mcp/hooks ~/.codex/plugins/workspace-json/
cp node_modules/@workspacejson/codex-mcp/.mcp.json ~/.codex/plugins/workspace-json/
```

The exact Codex plugin path depends on your Codex version and platform; the plugin manifest (`plugin.json`) references `./hooks/hooks.json` and `./.mcp.json` relative to the plugin root. The hook in `hooks/pre-edit-check.mjs` is the same file used for repo-native fallback and CI.

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

The hook fails open on missing/unparseable input (no workspace.json means no opinion, never a fabricated block) and never crashes the edit loop. A block is triggered by an **evidenced partner omission**: a co-change relationship recorded in `workspace.json` is absent from the proposed patch. It does not mean the partner is universally required for every semantic change.

## Tools

All are read-only and operate on the local `workspace.json`.

- **`workspace_get_file_context(path)`** — the primary call. Returns fragility (with reason/score/evidence when present) and co-change partners for one file. Call it before editing. Returns `fragile:false` with an empty partner list when a file has no recorded history: that means **no recorded risk**, not **verified safe**. The system never issues a safety approval; it only reports whether the evidence it holds supports a concern.
- **`workspace_get_cochange_partners(path)`** — the files that historically change with this one. Call it after an edit to catch related updates.
- **`workspace_list_fragile_files(limit?)`** — all fragile files, most fragile first. Orientation at the start of a task.
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

The smoke test (`scripts/smoke.mjs`) exercises the protocol end to end: initialize, `tools/list`, and tool calls including the two cases a lazy implementation gets wrong — absolute-vs-relative path matching and unknown-file (which must return empty, never a fabricated match).

## For the OpenAI Build Week submission

> This project was built during OpenAI Build Week as a new Codex integration for the open `workspace.json` standard. The `workspace.json` standard and its generator (`@workspacejson/cli`) are pre-existing open-source work, used here as a dependency the same way any participant could depend on it. The Build Week contribution is `@workspacejson/codex-mcp`: the MCP server, its tool surface, and the proactive-check wiring through Codex's `instructions` field, all authored in-window and contained in this repository.

## Verification status (honest tiers on our own claims)

VERIFIED (smoke suite drives the built server over stdio and the hook via stdin, 33 checks): protocol handshake and instructions, all four tools, tier derivation for ASSERTED/OBSERVED/VERIFIED (the VERIFIED tier is opt-in via `--verify` / `WJSON_VERIFY=1`: it re-runs a whitelisted read-only `git` command and reproduces its recorded output, downgrading to OBSERVED when it does not — never on the hook hot path), the deny/warn/none enforcement matrix, evidence citation in deny reasons, META-102 exact-first path matching with absolute-path fallback and fuzzy-match rejection, root-marker upward walk from a nested cwd, hook exit codes and JSON emission, fail-open on garbage input.

VERIFIED on real Codex 0.144.1 (2026-07-13): the installed plugin manifest loaded its `PreToolUse` hook; `hookSpecificOutput.permissionDecision: "deny"` plus exit code 2 blocked `apply_patch` under `WJSON_DENY_ALL=1`; unsetting it allowed a normal edit; the fixture denied a checkout-only edit with the recorded `revert d4e5f6` evidence and missing partners; and a single patch covering checkout, session, and format surfaced cautionary context and proceeded. The output contract and manifest remain isolated to single adapter points (`emitDecision()` in the hook; `.codex-plugin/plugin.json`).

## Current limitations

- Enforcement currently covers Codex `apply_patch`.
- Other edit mechanisms may receive context without deterministic blocking.
- Missing or malformed `workspace.json` fails open.
- Stale evidence is not treated as proof of current risk.
- `fragile:false` means the file has no recorded fragility, not that it is verified safe.
- This does not replace tests, review, or repository instructions.

## License

Apache-2.0
