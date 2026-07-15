# Checkout fixture verification

This public fixture is a small, controlled checkout scenario for reproducing
the documented co-change behavior. It is not a production incident record.

## Frozen fixture

- Repository: `workspace-json/codex-demo-fixture`.
- Annotated tag and commit: [`fixture-v2`](https://github.com/workspace-json/codex-demo-fixture/tree/dc6f4d721affac96d517ca96cad8ccf8d9c15e3c)
  → `dc6f4d721affac96d517ca96cad8ccf8d9c15e3c`.
- Artifact: [`.agents/workspace.json`](https://github.com/workspace-json/codex-demo-fixture/blob/dc6f4d721affac96d517ca96cad8ccf8d9c15e3c/.agents/workspace.json).
- Artifact Git blob: `a6807d3ad39aa3f3a1f3471c2ae1d4288f879149`.
- Artifact SHA-256:
  `5c97c81c8d6457e795c174d740026862512925cbf2efa9c66c1a18712285593d`.

The primary edit path is `src/routes/checkout.ts`; its recorded co-change
partners are `src/auth/session.ts` and `src/lib/format.ts`.

## Reproduce

```sh
git clone https://github.com/workspace-json/codex-demo-fixture.git
cd codex-demo-fixture
git switch --detach fixture-v2
npm test
```

The route-only regression commit
`ca1f7ec8e124b4050deb5cd6d704bea0fe1dcee7` fails `npm test`. The corrective
co-change commit `a9729be1486dc199adc1f42371847217cba9d883` and `fixture-v2`
pass it.

## Spec compatibility

The plugin reads only `manual.fragileFiles`, `manual.coChangePatterns`,
`generated.fileIndex`, and `generated.frameworkManifest` when present.

The frozen artifact is a documented validate-and-warn case: with
`@workspacejson/spec` v0.4.1, both `validate()` and `validateV4()` return
`false`. The consumer still normalizes the locked paths, returning the checkout
fragility record, both recorded partners, and an indexed primary path. This
does not turn the validation discrepancy into an approval or safety claim.
