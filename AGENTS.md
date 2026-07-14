# Agent guidance

Before editing or creating a file, call `workspace_get_file_context` on the target
path to check fragility and co-change partners. Treat a fragile result as a reason
to make minimal, well-tested changes; treat co-change partners as candidates for
related edits. If the tool is unavailable, record that limitation before making a
minimal change and do not represent the missing result as a safety signal.

## Issue and worktree contract

- Read the assigned Linear issue, its blockers, and the Build Week Execution Graph
  before implementation.
- Use one Linear issue per worktree. Record the starting commit and allowed files
  before writing.
- Serialize edits to shared files: `package.json`, lockfiles, `README.md`, root
  configuration, plugin manifests, and hook adapters.
- Stop when a newly discovered requirement changes evidence semantics, public
  claims, the proof fixture, credentials, or the submission scope. Those decisions
  require human approval.

## Evidence and review contract

- Never claim a change is safe. Missing or malformed workspace intelligence is
  `unknown` or `unavailable`, not approval.
- `ASSERTED`, `OBSERVED`, and `VERIFIED` are derived from evidence; never accept a
  producer- or model-supplied tier or confidence value.
- The GPT-5.6 adversarial reviewer is advisory and read-only. Its verdict never
  changes the deterministic hook decision.
- Run issue-specific checks and `npm run prepublishOnly` before handoff. For a bug
  regression, watch the guard fail without the fix before trusting the green.
- Run the adversarial reviewer after each logical implementation chunk and before
  the final implementation commit.

## Handoff

Append to `STATUS.md` with the issue, starting and ending commits, exact files,
commands and observed results, unresolved risks, and the next issue unblocked.
Handoffs without reproducible command output are incomplete.
