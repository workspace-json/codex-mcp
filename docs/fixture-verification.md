# Billfold fixture verification

Billfold is the public fixture for the `workspace.json` / Codex demonstration. It is a
small, controlled checkout scenario for reproducing the documented co-change behavior —
not a production incident record.

## Repository

- Repository: [`workspace-json/billfold`](https://github.com/workspace-json/billfold).
- Reference commit: [`5e97f1d`](https://github.com/workspace-json/billfold/tree/5e97f1dc9e6a41eb80d2d6eb80d5ef703cbe1cde)
  → `5e97f1dc9e6a41eb80d2d6eb80d5ef703cbe1cde` (2026-07-20).
- No annotated tag currently covers this pairing. The two existing tags,
  `fixture-v1` and `fixture-v2`, predate it and point to a different recorded
  pairing (`checkout.ts` co-changing with `src/auth/session.ts` and
  `src/lib/format.ts` — the same pairing this repo's own `fixture/` directory
  reproduces locally). Do not cite `fixture-v1`/`fixture-v2` for the pairing
  described below.
- Artifact: [`.agents/workspace.json`](https://github.com/workspace-json/billfold/blob/5e97f1dc9e6a41eb80d2d6eb80d5ef703cbe1cde/.agents/workspace.json).
- Artifact Git blob: `b86f453b716e1f03dc2cb93734e48ba20fdd9f55`.
- Artifact SHA-256:
  `be4072f3e1937f970fab290ec96ba9eabe34827623a84176be816d13e64b0484`.

This is the provider-demo proof path. It is separate from this repository's local
`fixture/` walkthrough, which records two checkout partners (`src/auth/session.ts` and
`src/lib/format.ts`); Billfold records the one checkout/Stripe partner below.

The primary edit path is `src/routes/checkout.ts`; its recorded co-change partner is
`src/webhooks/stripe.ts`. The relationship is not visible through a direct import or
shared symbol — checkout builds a retry key that the webhook parses independently.
It is recorded as a co-change pattern plus a fragility reason citing a 2026-02-28
rounding change to `checkout.ts` that was reverted two days later
(`985b0d4`, `05989dc`), both reproducible with the `git log`/`git show` commands
embedded in the artifact's own evidence entries.

## Reproduce

```sh
git clone https://github.com/workspace-json/billfold.git
cd billfold
git checkout 5e97f1dc9e6a41eb80d2d6eb80d5ef703cbe1cde
npm install
npx @workspacejson/codex-mcp install --with-hook
```

Ask Codex to change the idempotency-key format in `src/routes/checkout.ts` alone. The
hook denies the patch (exit code 2), citing the recorded evidence and the omitted
partner, `src/webhooks/stripe.ts`. Including that partner in the same patch clears the
deny; this confirms the recorded path is present, not that the included change is
correct — see the README's [Current limitations](../README.md#current-limitations).

`billfold`'s own `scripts/capture-red-evidence.mjs` still hardcodes a regression commit
(`ca1f7ec8e124b4050deb5cd6d704bea0fe1dcee7`) from the prior `session.ts`/`format.ts`
pairing, predating the `stripe.ts` evidence above. It has not been updated for this
pairing and should not be used to reproduce a red/green `npm test` pair for the
checkout/webhook relationship described here.

## Spec compatibility

The plugin reads only `manual.fragileFiles`, `manual.coChangePatterns`,
`generated.fileIndex`, and `generated.frameworkManifest` when present.

Checked against the currently published `@workspacejson/spec@0.4.3`: `validate()`
returns `true` for the reference artifact above; `validateV4()` and `validateLegacy()`
both return `false`. The consumer still normalizes the locked paths, returning the
checkout fragility record, the recorded partner, and an indexed primary path. This
does not turn the `validateV4()`/`validateLegacy()` result into an approval or safety
claim, and `validate() === true` is not a correctness claim about the recorded
evidence either — only that the document's shape matches the general schema.
