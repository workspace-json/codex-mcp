# Develop

```bash
npm install
npm run build     # tsc, strict
npm run smoke     # spawns the server over stdio and drives it via a real MCP client
```

The smoke test (`scripts/smoke.mjs`) exercises the protocol end to end: initialize, `tools/list`, all four tools, absolute-vs-relative path matching, unknown-file behavior, bounded text and structured responses, explicit fail-open warnings, hook decisions, and opt-in live verification.

## VS Code extension

The editor surface lives in [`extension/`](../extension) and builds independently:

```bash
npm run build:extension   # installs extension deps, compiles, and packages the VSIX into vsix/
```

`vsix/` is a build artifact (gitignored) that ships in the published npm tarball, so `install --with-extension` can install the pinned VSIX with no Marketplace round-trip. The installer's own paths — `UNAVAILABLE` with no `code` CLI, idempotent `ALREADY_INSTALLED`, ownership-checked artifacts, and consent-gated uninstall — are covered by `tests/unit/installer.test.ts` and run as part of `npm run verify`.
