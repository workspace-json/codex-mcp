# Clean-install and teardown audit (historical: 0.1.0)

> This audit records the 0.1.0 package named below. Its custom-agent reviewer
> transport was superseded by HAC-102's direct API reviewer; do not use this
> document as evidence for the 0.1.2 reviewer transport. A new packed-artifact
> audit is required for that release.

Date: 2026-07-13  
Source baseline: `43eb423` plus the current implementation diff  
Audit root: `/tmp/wjson-audit-final-84d54f` (ephemeral; not a product dependency)

## Packed artifact

```text
npm pack --pack-destination /tmp/wjson-audit-final-84d54f/package
workspacejson-codex-mcp-0.1.0.tgz
package size: 30.4 kB
unpacked size: 95.8 kB
total files: 25
shasum: 84d54f452acf2e131b1c0f4c5fd539be0c8d00b9
```

The tarball contained `.codex-plugin/plugin.json`, `.mcp.json`, the hook, built
server, installer, and the then-current custom-agent reviewer configuration.

## Clean dependency installation

```text
npm install --prefix /tmp/wjson-audit-final-84d54f/install \
  /tmp/wjson-audit-final-84d54f/package/workspacejson-codex-mcp-0.1.0.tgz \
  --ignore-scripts --offline
added 94 packages in 1s
```

The install ran offline against the isolated npm cache populated by the earlier
audit; it required no private registry, credential, repository, or runtime service.

## Installer and server

The packed installer ran twice with `install --with-hook`. Both runs completed,
and the generated configuration contained exactly one MCP block, reviewer block,
and hook block. The hook used the stable owned runtime copy under
`.codex/workspacejson-codex-mcp/`.

A real MCP client connected to the packed `dist/index.js`:

```json
{"tools":["workspace_assess_change","workspace_get_cochange_partners","workspace_get_file_context","workspace_list_fragile_files"],"action":"deny","bounded":true}
```

The packed hook was executed against the committed fixture:

```text
node hooks/pre-edit-check.mjs --paths src/routes/checkout.ts
exit: 2
permissionDecision: deny
missing: src/auth/session.ts, src/lib/format.ts
evidence: revert d4e5f6; incident 2026-03-02
```

## Teardown

The packed `uninstall` command removed the ownership-marked MCP, reviewer, and hook
blocks, reviewer file, and stable runtime directory while preserving an unrelated
`approval_policy` setting. Collision tests also prove that same-name unmanaged
configuration, reviewer files, and runtime directories are neither overwritten nor
removed. The final packed audit also preserved an indented unrelated TOML section
and the config's `0600` mode through two installs and uninstall. Earlier audits
exposed leading-section hook removal and runtime-ownership defects; both regressions
were fixed before the complete packed audit above.

## Result

No blocking clean-install, runtime, idempotency, payload-bound, or teardown defect
remains in the audited package. This result does not cover marketplace UI rendering,
OSes other than macOS, or the final external checkout proof fixture.
