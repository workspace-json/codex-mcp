# How it works

Three planes, each with a distinct authority. The reviewer never controls the hook; `PASS` is not a safety certification.

| Plane | Role | Authority |
| --- | --- | --- |
| Evidence | portable `workspace.json` history | descriptive |
| Action | MCP context + deterministic hook | mechanical enforcement on supported edits |
| Challenge | read-only GPT-5.6 reviewer | advisory |

## Evidence tiers

Every fragility signal carries a tier, derived **mechanically** by this package from the evidence attached to it. Producers (humans, tools, agents) record evidence; they never record a tier or a confidence value, and any such field in the artifact is ignored and re-derived:

| Tier | Meaning | Derivation |
| --- | --- | --- |
| `ASSERTED` | Claimed, no evidence recorded | zero evidence records |
| `OBSERVED` | Something was seen and written down | at least one evidence record (`{claim, command?, output?}` or bare observation) |
| `VERIFIED` | A green we watched | at least one evidence triple whose read-only command was re-run locally and reproduced its recorded output (`--verify` mode; whitelisted `git log/show/diff/grep/rev-parse/status` only) |

Tier drives enforcement strength, mechanically: an evidenced-fragile file whose recorded co-change partners are absent from the changeset is **denied**; evidenced fragility with partners covered **warns**; `ASSERTED` fragility only **annotates**. And deliberately: this system can justify a block or a warning, but it structurally never emits a safety approval. Absence of recorded risk is reported as absence, never as "safe" — the evidence class that would certify safety is exactly the class that cannot be verified by read-only re-run.

## Hooks (deterministic enforcement)

`hooks/pre-edit-check.mjs` is a PreToolUse hook for Codex's `apply_patch`: it parses the touched paths from the patch, assesses the whole changeset, and denies or warns before the edit lands. It is also the repo-native fallback and CI consumer:

```bash
git diff --name-only | node hooks/pre-edit-check.mjs --paths-stdin
node hooks/pre-edit-check.mjs --paths src/routes/checkout.ts
```

The hook fails open on missing or malformed intelligence and never crashes the edit loop. Fail-open is explicit: Codex receives an `unavailable` warning explaining that no fragility/co-change determination was made and how to validate or locate the artifact. A block is triggered by an **evidenced partner omission**: a co-change relationship recorded in `workspace.json` is absent from the proposed patch. It does not mean the partner is universally required for every semantic change.

## GPT-5.6 adversarial reviewer

The full installer registers a project-scoped `adversarial_reviewer` custom agent pinned to GPT-5.6 with high reasoning and a read-only sandbox. Invoke it after a logical change and before commit or demonstration. It returns a visible, attributed `BLOCK` or `PASS` verdict with reproduced evidence and explicit review gaps.

The reviewer is advisory. It cannot write files and its verdict never changes the deterministic hook decision. `PASS` means no blocking issue was found in the reviewed scope; it is not a safety certification. Missing or malformed workspace evidence is reported as `UNKNOWN`/`UNAVAILABLE`, not guessed away.
