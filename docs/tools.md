# Tools

All are read-only and operate on the local `workspace.json`.

- **`workspace_get_file_context(path)`** — the primary call. Returns fragility (with reason/score/evidence when present) and co-change partners for one file. Call it before editing. Returns `fragile:false` with an empty partner list when a file has no recorded history: that means **no recorded risk**, not **verified safe**. The system never issues a safety approval; it only reports whether the evidence it holds supports a concern.
- **`workspace_get_cochange_partners(path)`** — the files that historically change with this one. Call it after an edit to catch related updates.
- **`workspace_list_fragile_files(limit?)`** — all fragile files, most fragile first, plus bounded primitive framework context from `generated.frameworkManifest`. Orientation at the start of a task.
- **`workspace_assess_change(paths[])`** — evaluate a whole changeset; returns the mechanical `deny`/`warn`/`annotate`/`none` decision with per-file assessments. The MCP twin of the hook.
