# Build Week execution runbook

## Start

1. Read `AGENTS.md` and the assigned Linear issue and blockers.
2. Confirm a clean worktree and record `git rev-parse HEAD` in the Linear issue.
3. Create or select one issue-specific branch/worktree.
4. Declare allowed and forbidden files. Serialize shared-file changes.
5. Run `workspace_get_file_context` for every target path before mutation.

## Implement and verify

1. Reproduce the defect or unmet acceptance condition.
2. Add a regression guard and observe it fail when practical.
3. Make the smallest implementation that satisfies the issue.
4. Run targeted tests, then:

   ```sh
   npm_config_cache=/tmp/workspacejson-codex-mcp-npm-cache npm run prepublishOnly
   ```

5. Inspect `git diff --check`, `git diff --stat`, and the complete diff.
6. Invoke the read-only adversarial reviewer. Resolve every BLOCK or record a human
   decision; never silently downgrade it.

## Commit and handoff

1. Commit only the assigned scope with an issue-oriented message.
2. Update the Linear issue with commits, files, commands/results, risks, and
   the next issue unblocked.
3. For implementation PRs, request `@codex review`. Critical-path PRs also receive
   a second GPT-5.6 high-reasoning adversarial review.
4. Rebase or merge shared-file work serially; rerun the publish gate afterward.

## Release-candidate proof

Use the immutable fixture commit and artifact hash recorded by HAC-96. Preserve the
exact prompt, model, settings, raw baseline/protected outputs, reset command, and
commit range. Remove secrets, private paths, unrelated tabs, and internal strategy
from public artifacts. The final demo must be public, voiced, and under three
minutes.

## Teardown

Verify plugin disable/remove behavior, remove generated configuration and agent
files from the test checkout, and confirm unrelated Codex configuration remains
unchanged.
