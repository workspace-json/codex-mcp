# Operational status

Append-only implementation log. Claims below are backed by the recorded commands.

## 2026-07-13 — session baseline

- Scope: Build Week submission-critical implementation.
- Starting commit: `43eb423`.
- Baseline files committed: `.claude/settings.json`,
  `.claude/agents/adversarial-reviewer.md`.
- Validation command:
  `npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`.
- Observed result: typecheck and Biome passed; 49 unit tests passed; smoke reported
  `ALL GREEN`; package dry-run contained 24 files; publint reported `All good!`.
- Environment note: the first package check could not write the user npm cache
  because it contains root-owned files. Re-running with the isolated temporary
  cache completed successfully; no global cache ownership was changed.
- Open work: HAC-96, HAC-129, HAC-130, HAC-131, HAC-135, HAC-136 and downstream
  packaging/evidence tasks.

## 2026-07-13 — implementation and packed audit

- HAC-129: project config and CLI help now invoke the `server` subcommand; regression
  tests cover both paths.
- HAC-130: malformed, missing, and unparseable intelligence fails open with explicit
  unavailable context; integrated hook cases pass.
- HAC-131: structured MCP results are bounded to 12,000 characters, report honest
  truncation, and retain the primary deny assessment; real-MCP boundary probes pass.
- HAC-113: `workspace_list_fragile_files` surfaces bounded primitive framework
  context without adding a fifth tool.
- HAC-135: repository guidance, execution plan, runbook, and this append-only log
  are present.
- HAC-136 substrate: project-scoped reviewer is pinned to GPT-5.6/high, read-only,
  installed by the fallback installer, and documented as advisory-only.
- Packaging: complete manifest metadata, repo marketplace entry, reviewer tarball
  inclusion, idempotent install, and managed uninstall are implemented.
- Validation: 58 unit tests passed; the built-server/hook smoke suite reported
  `ALL GREEN`; package dry-run and publint passed.
- Clean install: the real tarball installed in `/tmp`, exposed four tools, returned
  a bounded deny, blocked the checkout-only hook case, and fully removed managed
  config on teardown. See `docs/clean-install-audit.md`.
- Fixture: artifact blob/SHA-256 and proof relationship recorded in
  `docs/fixture-verification.md`. External source repo/commit and three-run baseline
  remain a human gate.

## 2026-07-13 — adversarial remediation and final verification

- First live review: `gpt-5.6-sol`, high reasoning, read-only, session
  `019f5de0-581c-7e60-abc6-708f0ca28a9c`; verdict `BLOCK`. Reproduced findings
  covered malformed artifact roots, later-deny loss, dishonest bounded counts,
  unsafe installer collisions, inherited MCP scope, repository-boundary discovery,
  and an ephemeral hook path.
- Remediation: invalid roots/sections now become explicit unavailable warnings;
  the highest-severity deny is protected; returned/total list counts are honest;
  discovery stops at the nearest Git boundary; the reviewer declares only the
  workspacejson MCP; installation uses ownership markers, atomic config writes,
  and a stable runtime copy; unmanaged collisions are refused and preserved.
- Validation command:
  `TMPDIR=/tmp npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly`.
  Final observed result: typecheck/lint passed, 69 unit tests passed, smoke reported
  `ALL GREEN`, the package contained 25 files, and publint reported `All good!`.
- Final packed audit: tarball SHA-1
  `84d54f452acf2e131b1c0f4c5fd539be0c8d00b9`; offline clean install added 94
  packages; two installs were idempotent; the stable hook denied the checkout-only
  case; a real MCP client listed four tools and returned a bounded deny; install and
  uninstall preserved an unrelated indented table and its config's `0600` mode;
  uninstall removed every owned artifact.
- Reviewer runtime note: the configured custom-agent spawn failed in Codex 0.144.3
  with `no thread with id`. Direct `gpt-5.6-sol`/high/read-only review succeeded and
  produced the blocking evidence above. Final focused review session
  `019f5e18-85be-72f3-8b42-98634f9cd861` verified the TOML-boundary and file-mode
  remediations and returned `VERDICT: PASS` with no reproducible defect.
- Unresolved human gates: HAC-96 external fixture/source proof, marketplace UI and
  non-macOS checks, the voiced public demo, final `/feedback` Session ID, and final
  submission assembly.
- Closing marker: the commit containing this entry follows baseline `43eb423` and
  the final gate above; Git history is the canonical immutable identifier.
