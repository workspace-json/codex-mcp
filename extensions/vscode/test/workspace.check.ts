import assert from "node:assert/strict";
import test from "node:test";
import { parseDecorationSnapshot, relativeWorkspacePath } from "../src/workspace.js";
test("normalizes keys like the canonical matcher and ignores producer tier", () => {
  const snapshot = parseDecorationSnapshot({ manual: { fragileFiles: [{ path: "src//./routes/checkout.ts/", tier: "VERIFIED", confidence: 1, evidence: [{ claim: "red run" }] }] } });
  assert.equal(snapshot?.fragileFiles.get("src/routes/checkout.ts")?.tier, "OBSERVED");
  assert.equal(relativeWorkspacePath("/repo", "/repo/src//routes/checkout.ts"), "src/routes/checkout.ts");
});
test("rejects paths outside the workspace", () => assert.equal(relativeWorkspacePath("/repo", "/other/file.ts"), undefined));
test("treats missing or malformed workspace intelligence as unavailable", () => {
  assert.equal(parseDecorationSnapshot(undefined), undefined);
  assert.equal(parseDecorationSnapshot({ manual: { fragileFiles: "not-an-array" } }), undefined);
  const snapshot = parseDecorationSnapshot({ manual: { fragileFiles: [{ path: "../outside.ts" }, { path: "src/kept.ts" }] } });
  assert.deepEqual([...snapshot!.fragileFiles.keys()], ["src/kept.ts"]);
  assert.equal(snapshot?.fragileFiles.get("src/kept.ts")?.tier, "ASSERTED");
});
