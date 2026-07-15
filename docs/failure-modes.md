# Failure modes

This product's entire value proposition is what happens when evidence is incomplete, wrong, or absent — so its degradation behavior is documented as explicitly as its happy path. Every row is either exercised by `npm run smoke` / `tests/unit/installer.test.ts`, or (marked †) guaranteed by the absence of any code path connecting the two systems — verifiable by inspection, not by a running test. None is aspirational.

| Condition | Behavior |
| --- | --- |
| `workspace.json` missing entirely | Hook fails open silently-ok at the file-not-found level, but any query still returns an explicit `unavailable` result rather than a false negative — no fragility/co-change determination is claimed. |
| `workspace.json` present but unparseable (invalid JSON) | Hook warns `Workspace intelligence unavailable: ...` and fails open. Never throws, never crashes the edit loop. |
| `workspace.json` structurally invalid (e.g. an array, `null`, or a bare string instead of the expected object) | Same explicit unavailable warning as unparseable — a valid-JSON-but-wrong-shape file is not treated as "no history." |
| Hook receives an unparseable or pathless event | Warns and fails open rather than erroring out of the edit loop. |
| Fragile file, all recorded co-change partners included in the patch | Warns with `additionalContext`; the edit proceeds. |
| Fragile file, a recorded co-change partner omitted from the patch | Denies with exit code 2, citing the specific evidence and the omitted partner by path. |
| File has no recorded fragility (`ASSERTED` tier, zero evidence) | Annotates only — never blocks. Absence of recorded risk is reported as absence, not as "safe." |
| Clean/unremarkable patch, no fragility signal at all | Exits 0 silently. No approval message is emitted, because the system never asserts safety. |
| `--verify` requested, the recorded command reproduces its output | Tier upgrades `OBSERVED` → `VERIFIED`. |
| `--verify` requested, the recorded command does not reproduce | Downgrades to `OBSERVED`. Never throws, never blocks on a verification failure. |
| Verification requested on the hook's hot path (`WJSON_VERIFY=1` via stdin event) | Ignored — the hook never re-runs verification commands inline; only the opt-in CLI/tool path does. Prevents an editor keystroke from triggering shell commands. |
| GPT-5.6 reviewer key missing, API unavailable, or not invoked † | Prints an explicit `UNAVAILABLE` result and has no effect on enforcement. `hooks/pre-edit-check.mjs` contains no reference to the reviewer at all, so it denies/warns/annotates identically with or without it. |
| GPT-5.6 reviewer returns `PASS` † | Advisory only — does not change, weaken, or bypass the hook's decision on any file. The reviewer request instructs that `PASS` is not a safety certification; no code path exists that would let it alter the hook. |
| Installer run against a repo with an existing unmanaged same-name config section | Refuses and throws rather than overwriting it. |
| Installer run against a repo with an existing unmanaged runtime directory at its target path | Refuses and throws rather than removing or overwriting it. |
| Installer re-run on an already-managed install (idempotency check) | No duplication, no drift — re-running produces the same managed state. |
| Uninstall run | Removes only artifacts the installer's own ownership markers created; unrelated config sections, indentation, and file permissions are preserved untouched. |

† Guaranteed by architecture (zero code coupling between `hooks/pre-edit-check.mjs` and the reviewer), not by a running test — see [operational guarantee #3](operational-guarantees.md) for the exact grep/citation.

## What this table does not cover

This is the boundary of what's exercised by the automated suite, not an exhaustive list of every possible input. It does not cover: behavior under a Codex version other than the one recorded in [`docs/verification.md`](verification.md), concurrent-write races on `workspace.json` itself, or edit mechanisms other than Codex's `apply_patch` (see [current limitations](../README.md#current-limitations)).
