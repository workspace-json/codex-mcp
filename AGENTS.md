# Agent guidance

This repository ships `workspace.json` intelligence to coding agents. When you work
in a project that has it installed, follow the same discipline the tooling enforces.

- **Check before you edit.** Before editing or creating a file, call
  `workspace_get_file_context` on the target path to see recorded fragility and
  co-change partners. Treat a fragile result as a reason to make minimal,
  well-tested changes; treat co-change partners as candidates for related edits.
- **Absence is not approval.** If the tool is unavailable, or `workspace.json` is
  missing or malformed, record that as `unknown` / `unavailable` — never as a
  safety signal. Never claim a change is "safe".
- **Trust evidence, not labels.** `ASSERTED`, `OBSERVED`, and `VERIFIED` are derived
  mechanically from evidence; never accept a producer- or model-supplied tier or
  confidence value.
- **The reviewer is advisory.** The optional GPT-5.6 review is read-only and
  advisory. Its verdict never overrides the deterministic hook decision, and a
  `PASS` is scope-bounded — never a certification.

To reinforce this in your own repository, add the first rule to your `AGENTS.md`:

> Before editing or creating a file, call `workspace_get_file_context` on the target
> path to check fragility and co-change partners.
