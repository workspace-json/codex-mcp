# workspace.json / Codex — draft judge-demo narration

Status: draft. This source remains deliberately provisional until HAC-98 preserves
the fixture evidence and HAC-136 preserves the visible reviewer artifact. Square
brackets are on-screen replacement instructions; the spoken source uses a clear
placeholder rather than invented facts.

1. **00:00–00:12 — Problem**  
   A realistic checkout change can look complete in one file and still miss the
   work that makes it correct. workspace.json gives Codex local repository evidence
   before that risky edit lands.

2. **00:12–00:38 — Unprotected proposal**  
   Here, Codex receives a bounded request to change checkout behavior. An
   unprotected proposal can be locally plausible: update the route, see a
   clean-looking diff, and stop. But a checkout-only change can omit the session
   and formatting partners that the repository has previously needed. This is a
   controlled experimental fixture, not a production incident.

3. **00:38–01:08 — Evidence and denial**  
   Before the supported edit, workspace.json surfaces the relevant history and
   evidenced co-change partners. Its deterministic hook evaluates the proposed
   changeset, not a model hunch. When the route is present but required partners
   are absent, the hook denies the incomplete edit and explains the recorded basis.
   That denial is a prompt to investigate, not a claim that every checkout change
   needs the same files.

4. **01:08–01:35 — Correction and verification**  
   Codex then revises the changeset to cover the route and its evidenced partners.
   The story is not that the tool writes the change. The story is that repository
   context changes the decision before the edit. Targeted verification then runs
   against the corrected fixture. **[HAC-98: insert the exact command, commit, and
   result after preserved evidence exists.]**

5. **01:35–02:02 — GPT-5.6 reviewer**  
   After the completed change, a read-only GPT-5.6 reviewer examines the proposal
   and its evidence. It can challenge reasoning, name gaps, and leave a visible
   advisory verdict. It cannot edit files, and it cannot alter the hook decision.
   **[HAC-136: insert the captured reviewer outcome.]** A pass is not a safety
   certification.

6. **02:02–02:28 — Three planes and installation**  
   That separation is deliberate. Evidence is the local MCP context plane.
   Deterministic enforcement is the action plane. The reviewer is the challenge
   plane. Installation is local, managed, and reversible: the package adds only
   marked configuration and removes only what it owns. It works over stdio, keeps
   repository contents local at runtime, and does not replace tests or human review.

7. **02:28–02:50 — Boundary and close**  
   The boundary is simple. Missing evidence is unknown, not safe. The hook can
   justify a block or warning; it never certifies an edit as safe. The reviewer
   remains advisory. Human authority remains final. workspace.json helps Codex make
   a better informed decision, while the repository and its maintainers keep control.

## Recording notes

- Use the `text` field in `scenes.json` for generation and captions; it contains
  narration-safe pronunciations such as “workspace dot json”. `displayText` keeps
  the product spelling for on-screen copy.
- Pause for the configured post-roll after the deterministic denial, passing test,
  reviewer verdict, and final lockup. Do not fill those proof beats with narration.
- Do not remove the fixture disclosure or collapse the reviewer into enforcement.
- Replace the two evidence placeholders only during HAC-160, using preserved
  HAC-98/HAC-136 artifacts. Re-time and regenerate then.
