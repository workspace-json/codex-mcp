import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * §1.5 / §9 structural invariant: exactly one extension reader of
 * workspace.json. We enforce it at the source level — `parseSnapshot(` (the
 * only function that turns raw workspace.json into the model) may be *called*
 * from exactly one module, workspaceIntelligence.ts. Any renderer that grew a
 * second parse path would trip this.
 */
// Compiled to CommonJS (out/test/*.check.js), so __dirname is out/test.
const srcDir = join(__dirname, "..", "..", "src");

function sourceFiles(): { name: string; text: string }[] {
  return readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({ name, text: readFileSync(join(srcDir, name), "utf8") }));
}

test("parseSnapshot is called from exactly one module (single reader of workspace.json)", () => {
  const callers = sourceFiles()
    .filter((file) => file.name !== "parseSnapshot.ts")
    .filter((file) => /parseSnapshot\s*\(/.test(file.text))
    .map((file) => file.name);
  assert.deepEqual(callers, ["workspaceIntelligence.ts"]);
});

test("the reviewer receipt is parsed in exactly one module (single receipt validator)", () => {
  const callers = sourceFiles()
    .filter((file) => /loadLatestReceipt\s*\(/.test(file.text) && file.name !== "reviewerVerdict.ts")
    .map((file) => file.name);
  // Only the model wires the receipt loader into the intelligence event.
  assert.deepEqual(callers, ["workspaceIntelligence.ts"]);
});

test("no renderer reads the workspace artifact off disk itself", () => {
  const artifactReaders = sourceFiles()
    .filter((file) => file.name !== "workspaceIntelligence.ts")
    .filter((file) => /readFile\s*\(/.test(file.text) && /workspace\.json/.test(file.text))
    .map((file) => file.name);
  assert.deepEqual(artifactReaders, []);
});
