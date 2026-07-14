# Develop

```bash
npm install
npm run build     # tsc, strict
npm run smoke     # spawns the server over stdio and drives it via a real MCP client
```

The smoke test (`scripts/smoke.mjs`) exercises the protocol end to end: initialize, `tools/list`, all four tools, absolute-vs-relative path matching, unknown-file behavior, bounded text and structured responses, explicit fail-open warnings, hook decisions, and opt-in live verification.
