# Agent guidance

Before editing or creating a file, call `workspace_get_file_context` on the target
path to check fragility and co-change partners. Treat a fragile result as a reason
to make minimal, well-tested changes; treat co-change partners as candidates for
related edits.
