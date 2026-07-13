import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const fixtureRoot = resolve(root, "fixture");

let failures = 0;
function check(name, cond, detail) {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  ->  ${detail}` : ""}`);
}

const transport = new StdioClientTransport({
  command: "node",
  args: [resolve(root, "dist/index.js")],
  env: { ...process.env, WORKSPACE_JSON_ROOT: fixtureRoot },
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

// ── Protocol surface ──
const instr = client.getInstructions();
check("initialize exposes server instructions", instr?.includes("FRAGILE"));

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
check(
  "tools/list returns the 4 expected tools",
  JSON.stringify(names) ===
    JSON.stringify([
      "workspace_assess_change",
      "workspace_get_cochange_partners",
      "workspace_get_file_context",
      "workspace_list_fragile_files",
    ]),
  names.join(","),
);

// ── Tier derivation through file context ──
const r1 = await client.callTool({ name: "workspace_get_file_context", arguments: { path: "src/db/client.ts" } });
const s1 = r1.structuredContent;
check("evidenced fragile -> tier OBSERVED", s1?.fragility?.tier === "OBSERVED", JSON.stringify(s1?.fragility));
check(
  "evidence normalized to {claim} records",
  s1?.fragility?.evidence?.[0]?.claim?.includes("revert"),
  JSON.stringify(s1?.fragility?.evidence),
);
check("fragile file -> co-change partner schema.ts", s1?.coChangePartners?.includes("src/db/schema.ts"));

const r2 = await client.callTool({ name: "workspace_get_file_context", arguments: { path: "src/auth/session.ts" } });
check(
  "bare-string fragile -> tier ASSERTED",
  r2.structuredContent?.fragility?.tier === "ASSERTED",
  JSON.stringify(r2.structuredContent?.fragility),
);

// ── META-102 matching contract ──
const r3 = await client.callTool({ name: "workspace_get_file_context", arguments: { path: "./src/db/client.ts" } });
check("leading ./ normalizes to exact key match", r3.structuredContent?.fragile === true);
const r4 = await client.callTool({
  name: "workspace_get_file_context",
  arguments: { path: "/abs/repo/src/db/client.ts" },
});
check("absolute path falls back to boundary suffix match", r4.structuredContent?.fragile === true);
const r5 = await client.callTool({ name: "workspace_get_file_context", arguments: { path: "db/client.ts" } });
check(
  "bare partial relative path does NOT match (exact-first, no fuzzy)",
  r5.structuredContent?.fragile === false,
  JSON.stringify(r5.structuredContent?.path),
);

// ── Empty beats wrong ──
const r6 = await client.callTool({
  name: "workspace_get_file_context",
  arguments: { path: "src/lib/does-not-exist.ts" },
});
check(
  "unknown file -> fragile:false, empty partners",
  r6.structuredContent?.fragile === false && r6.structuredContent?.coChangePartners?.length === 0,
);
check(
  "unknown file guidance never says safe",
  /not evidence of safety/i.test(r6.structuredContent?.guidance ?? ""),
  r6.structuredContent?.guidance,
);

// ── Changeset assessment: the deny/warn/none matrix ──
const d1 = await client.callTool({ name: "workspace_assess_change", arguments: { paths: ["src/routes/checkout.ts"] } });
check(
  "evidenced fragile + missing partners -> DENY",
  d1.structuredContent?.action === "deny",
  JSON.stringify(d1.structuredContent?.action),
);
check(
  "deny message cites evidence",
  /revert d4e5f6/.test(d1.structuredContent?.assessments?.[0]?.message ?? ""),
  d1.structuredContent?.assessments?.[0]?.message,
);
check(
  "deny message names missing partners",
  /src\/auth\/session\.ts/.test(d1.structuredContent?.assessments?.[0]?.message ?? ""),
);

const d2 = await client.callTool({
  name: "workspace_assess_change",
  arguments: { paths: ["src/routes/checkout.ts", "src/auth/session.ts", "src/lib/format.ts"] },
});
check(
  "partners covered -> downgrades to WARN",
  d2.structuredContent?.action === "warn",
  JSON.stringify(d2.structuredContent?.action),
);

const d3 = await client.callTool({ name: "workspace_assess_change", arguments: { paths: ["src/lib/new-file.ts"] } });
check("clean changeset -> action none, no approval language", d3.structuredContent?.action === "none");

// ── Audit Critical #1 regression: partial-path partners must NOT be credited ──
const dPartial = await client.callTool({
  name: "workspace_assess_change",
  arguments: { paths: ["src/routes/checkout.ts", "auth/session.ts", "lib/format.ts"] },
});
check(
  "partial-path partners NOT credited -> deny holds (was downgraded pre-fix)",
  dPartial.structuredContent?.action === "deny",
  JSON.stringify(dPartial.structuredContent?.action),
);
const dAbs = await client.callTool({
  name: "workspace_assess_change",
  arguments: { paths: ["/x/repo/src/routes/checkout.ts", "/x/repo/src/auth/session.ts", "/x/repo/src/lib/format.ts"] },
});
check(
  "absolute-path partners ARE credited -> warn",
  dAbs.structuredContent?.action === "warn",
  JSON.stringify(dAbs.structuredContent?.action),
);

// ── Audit #5: directly exercise the two tools smoke previously only registered ──
const cc = await client.callTool({
  name: "workspace_get_cochange_partners",
  arguments: { path: "src/routes/checkout.ts" },
});
check(
  "get_cochange_partners returns both partners directly",
  (cc.structuredContent?.partners ?? []).includes("src/auth/session.ts") &&
    (cc.structuredContent?.partners ?? []).includes("src/lib/format.ts"),
  JSON.stringify(cc.structuredContent?.partners),
);
const lf = await client.callTool({ name: "workspace_list_fragile_files", arguments: {} });
check(
  "list_fragile_files returns total 3, sorted by score",
  lf.structuredContent?.total === 3 && lf.structuredContent?.files?.[0]?.path === "src/db/client.ts",
  JSON.stringify(lf.structuredContent?.files?.map((f) => f.path)),
);

await client.close();

// ── Hook script, driven exactly as Codex would drive it ──
function runHook(stdinObj, extraEnv = {}) {
  return spawnSync("node", [resolve(root, "hooks/pre-edit-check.mjs")], {
    input: JSON.stringify(stdinObj),
    encoding: "utf8",
    env: { ...process.env, WORKSPACE_JSON_ROOT: fixtureRoot, ...extraEnv },
  });
}

const patchDeny = {
  tool_name: "apply_patch",
  tool_input: {
    command: "*** Begin Patch\n*** Update File: src/routes/checkout.ts\n@@\n-const a=1\n+const a=2\n*** End Patch",
  },
};
const h1 = runHook(patchDeny);
check("hook: fragile-without-partner patch exits 2", h1.status === 2, `status=${h1.status}`);
const h1out = (() => {
  try {
    return JSON.parse(h1.stdout);
  } catch {
    return null;
  }
})();
check("hook: emits permissionDecision deny JSON", h1out?.hookSpecificOutput?.permissionDecision === "deny", h1.stdout);
check(
  "hook: deny reason cites evidence",
  /revert d4e5f6/.test(h1out?.hookSpecificOutput?.permissionDecisionReason ?? ""),
);

const patchWarn = {
  tool_name: "apply_patch",
  tool_input: {
    command:
      "*** Begin Patch\n*** Update File: src/routes/checkout.ts\n*** Update File: src/auth/session.ts\n*** Update File: src/lib/format.ts\n*** End Patch",
  },
};
const h2 = runHook(patchWarn);
check(
  "hook: partners-covered patch exits 0 with additionalContext",
  h2.status === 0 && /additionalContext/.test(h2.stdout),
  `status=${h2.status} out=${h2.stdout.slice(0, 80)}`,
);

const patchClean = {
  tool_name: "apply_patch",
  tool_input: { command: "*** Begin Patch\n*** Add File: src/lib/brand-new.ts\n*** End Patch" },
};
const h3 = runHook(patchClean);
check(
  "hook: clean patch exits 0 silently (no approval emitted)",
  h3.status === 0 && h3.stdout.trim() === "",
  `out='${h3.stdout}'`,
);

const h4 = runHook({ garbage: true });
check("hook: unparseable/pathless event stays out of the way", h4.status === 0);

const h5 = runHook(patchClean, { WJSON_DENY_ALL: "1" });
check("hook: WJSON_DENY_ALL wiring probe denies", h5.status === 2 && /deny/.test(h5.stdout));

// ── Root-marker walk: run hook from a NESTED directory, no env root ──
const nested = resolve(fixtureRoot, "packages/deep/nested");
mkdirSync(nested, { recursive: true });
const h6 = spawnSync("node", [resolve(root, "hooks/pre-edit-check.mjs"), "--paths", "src/routes/checkout.ts"], {
  cwd: nested,
  encoding: "utf8",
  env: { ...process.env, WORKSPACE_JSON_ROOT: "" },
});
check(
  "root-marker walk finds workspace.json from nested cwd",
  h6.status === 2,
  `status=${h6.status} stderr=${h6.stderr.slice(0, 80)}`,
);
rmSync(resolve(fixtureRoot, "packages"), { recursive: true, force: true });

console.log(`\n${failures === 0 ? "ALL GREEN" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
