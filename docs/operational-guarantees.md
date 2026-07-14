# Operational guarantees

Six promises, each checkable against the code and tests in this repository rather than taken on faith. Reproduce them yourself with `npm run verify` (see below) or by reading the cited source.

1. **Missing evidence never becomes a safety approval.** `workspace_get_file_context` returns `fragile:false` with an empty partner list when a file has no recorded history — that means *no recorded risk*, not *verified safe*. The system has no code path that emits a positive safety signal. See [`docs/tools.md`](tools.md) and [`docs/how-it-works.md`](how-it-works.md).

2. **Malformed evidence never crashes the edit loop.** Missing, corrupt, or structurally invalid `workspace.json` produces an explicit `Workspace intelligence unavailable: ...` warning and fails open — it never throws and never silently allows without saying so (`hooks/pre-edit-check.mjs:94`). Exercised directly in the smoke suite (`npm run smoke`): `hook: corrupt workspace.json warns and fails open`, `hook: structurally invalid workspace.json warns and fails open`, `hook: missing workspace.json warns and fails open`, `hook: unparseable/pathless event warns but fails open`.

3. **Reviewer output never controls deterministic enforcement.** The GPT-5.6 reviewer (`.codex/agents/adversarial-reviewer.toml`) runs `sandbox_mode = "read-only"` and has no code path connecting it to the hook — `hooks/pre-edit-check.mjs` contains no reference to the reviewer at all. Its own instructions state plainly: "The deterministic hook remains the only enforcement plane" and a `PASS` verdict "must never alter the hook decision."

4. **Installation never overwrites unmanaged configuration.** The installer refuses and throws rather than silently overwriting when it finds a same-name section, reviewer file, or runtime directory it didn't create (`scripts/install.mjs:66,221,224`). Covered by `tests/unit/installer.test.ts`: `refuses to overwrite or remove unmanaged same-name configuration`, `refuses to overwrite or remove an unmanaged runtime directory`, `preserves indented unrelated TOML sections and private config permissions`.

5. **Uninstall removes only owned artifacts.** The same ownership markers that gate installation gate removal — `npx @workspacejson/codex-mcp uninstall` only touches what it wrote, verified by the same installer test suite and the [clean-install audit](clean-install-audit.md).

6. **Every `VERIFIED` claim maps to a reproducible command.** `ASSERTED`/`OBSERVED`/`VERIFIED` are derived mechanically from evidence, never accepted as a producer-supplied value (`src/evidence.ts`); the `--verify` path re-runs a whitelisted, read-only command and downgrades to `OBSERVED` rather than throwing when it doesn't reproduce. The full list of what's actually been verified, and how, is in [`docs/verification.md`](verification.md).

## Reproduce this yourself

```bash
git clone https://github.com/workspace-json/codex-mcp.git
cd codex-mcp
npm ci
npm run verify
```

`npm run verify` runs the same checks this repository's CI runs (`.github/workflows/ci.yml`) — repository structure, typecheck, lint, build, the full unit-test suite, and the smoke suite — as one local command instead of separate CI steps. What it proves: the six guarantees above and everything in [`docs/verification.md`](verification.md). What it does not prove: that a specific external Codex install, network environment, or `workspace.json` you supply behaves identically — see [`docs/failure-modes.md`](failure-modes.md) for how the system behaves when its inputs aren't what it expects.
