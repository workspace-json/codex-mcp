---
name: code-change-verification
description: Verify completed changes to runtime code, tests, packaging, installation, hooks, or build behavior. Use after such changes and before handoff or commit to produce command-backed pass, fail, or incomplete results without hiding skipped checks.
---

# Code Change Verification

Verify the exact commit and issue scope. Report commands and observed results;
never convert missing evidence or a reviewer verdict into a safety claim.

## Inputs

Require the issue acceptance criteria, start/end commits, changed files, allowed
files, and any issue-specific reproduction command. Mark verification incomplete
when these are unavailable.

## Base verification

Run from the repository root in this order:

```sh
npm ci
npm run build
npm test
npm run smoke
npm pack --dry-run
```

`npm ci` is mandatory for every invocation of this skill. A skipped, failed, or
network-blocked command makes the overall result incomplete or failed, never
successful. Use an isolated npm cache when the user cache is unwritable.

Then run the repository publish gate, `git diff --check`, inspect `git diff
--stat`, and inspect the complete diff. A passing publish gate does not erase a
failed required command.

## Regression and issue-specific checks

For bug fixes, observe the guard fail without the fix when practical. Use a
reversible temporary worktree or a narrowly targeted test; do not alter the frozen
fixture or evidence to manufacture failure.

Add checks required by the changed boundary:

- Packed artifact: install the generated tarball in a clean temporary directory.
- Hook denial: reproduce the incomplete edit and inspect exit code and denial.
- Missing/malformed evidence: confirm an explicit unavailable warning and
  fail-open behavior.
- Structured output: exercise a real MCP client and assert both channels remain
  bounded while preserving the primary denial.
- Uninstall: enumerate created files, remove owned artifacts, and verify unrelated
  configuration and user data remain.

Run the read-only GPT-5.6 adversarial reviewer after each logical chunk and before
the final implementation commit. Treat its verdict as advisory only.

## Required output

Return a table with command, exact scope, exit code, and observed result, followed
by changed files, skipped checks, reviewer session/verdict, residual risks, and an
overall `PASS`, `FAIL`, or `INCOMPLETE`. Report `PASS` only when every required
command ran and passed.

## Stop behavior

Stop the handoff on any required failure, unexplained diff, out-of-scope file,
unresolved reviewer BLOCK, or inability to reproduce a required issue condition.
Preserve the failing output and name the next exact command or decision needed.
