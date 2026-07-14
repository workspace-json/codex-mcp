---
name: implementation-strategy
description: Plan changes to runtime behavior, hooks, MCP outputs, installer behavior, package exports, or public contracts before editing. Use when a requested change can affect compatibility, evidence semantics, the frozen demo path, or judge-facing behavior.
---

# Implementation Strategy

Produce an implementation boundary and proof plan before changing files. This is
planning guidance, not approval to change evidence or public claims.

## Inputs

Collect the request, Linear issue, blockers, Build Week Execution Graph, starting
commit, worktree, candidate paths, and current acceptance criteria. If an input is
missing, label it unavailable instead of guessing.

## Workflow

1. Read `AGENTS.md`, `docs/project/plan.md`, `docs/project/runbook.md`, the
   assigned issue, its relations, and the execution graph.
2. Confirm one issue per worktree and record the starting commit.
3. Call `workspace_get_file_context` for every candidate target. Record missing
   tool/results as unavailable; never interpret them as approval.
4. Identify the affected boundary: runtime, hook protocol, MCP schema/output,
   install/uninstall, package/export, evidence, or public contract.
5. Trace consumers and co-change partners. Separate required edits from possible
   follow-ups.
6. Define tests that reproduce the unmet condition and proof that demonstrates
   the change without strengthening a claim.
7. Decide whether the change invalidates the frozen demo path or preserved
   evidence.

## Required output

Return these fields before editing:

- Compatibility boundary
- Starting commit and worktree
- Allowed files
- Forbidden files
- Linear issue, blockers, and issues unblocked
- Workspace fragility/co-change results, including unavailable results
- Public-claim and evidence impact
- Frozen-demo impact: unchanged, invalidated, or unknown
- Required regression, targeted, package, and publish-gate checks
- Proof artifacts to preserve
- Stop conditions and human approvals required

## Stop conditions

Stop and request human direction if new information changes evidence semantics,
public wording, the proof fixture, credentials/settings, submission scope, or a
shared-file ownership boundary. Stop when the issue lacks an isolatable file scope
or depends on an unresolved blocker. Do not let a model verdict waive a stop.
