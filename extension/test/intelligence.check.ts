import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKey, pathsMatch, relativeWorkspacePath } from "../src/pathMatch.js";
import { parseSnapshot } from "../src/parseSnapshot.js";

// -- pathMatch ---------------------------------------------------------------

test("normalizeKey collapses ./, //, and trailing slashes", () => {
  assert.equal(normalizeKey("src//./routes/checkout.ts/"), "src/routes/checkout.ts");
});

test("pathsMatch: exact match and absolute-suffix fallback only", () => {
  assert.equal(pathsMatch("src/a.ts", "src/a.ts"), true);
  assert.equal(pathsMatch("/repo/src/a.ts", "src/a.ts"), true);
  assert.equal(pathsMatch("/other/a.ts", "a.ts"), false); // single-segment stored key never fuzzy-matches
});

test("relativeWorkspacePath rejects paths outside the workspace", () => {
  assert.equal(relativeWorkspacePath("/repo", "/repo/src//routes/checkout.ts"), "src/routes/checkout.ts");
  assert.equal(relativeWorkspacePath("/repo", "/other/file.ts"), undefined);
});

// -- parseSnapshot: top-level shape ------------------------------------------

test("treats missing, non-object, or array workspace.json as unavailable", () => {
  assert.equal(parseSnapshot(undefined), undefined);
  assert.equal(parseSnapshot(null), undefined);
  assert.equal(parseSnapshot("not-an-object"), undefined);
  assert.equal(parseSnapshot([]), undefined); // the exact HAC-130 F1 repro case
});

test("treats manual/generated present-but-wrong-shape as unavailable", () => {
  assert.equal(parseSnapshot({ manual: "nope", generated: {} }), undefined);
  assert.equal(parseSnapshot({ manual: {}, generated: [] }), undefined);
});

test("missing manual/generated containers is valid and empty (silent-ok)", () => {
  const snapshot = parseSnapshot({});
  assert.equal(snapshot?.fragileFiles.size, 0);
  assert.equal(snapshot?.fileIndex.size, 0);
});

// -- parseSnapshot: fragileFiles ---------------------------------------------

test("a wrong-shaped fragileFiles field degrades to empty, not whole-snapshot unavailable", () => {
  const snapshot = parseSnapshot({ manual: { fragileFiles: "not-an-array" }, generated: {} });
  assert.equal(snapshot?.fragileFiles.size, 0);
});

test("derives OBSERVED from evidence and ignores producer-supplied tier/confidence", () => {
  const snapshot = parseSnapshot({
    manual: { fragileFiles: [{ path: "src//./routes/checkout.ts/", tier: "VERIFIED", confidence: 1, evidence: [{ claim: "red run" }] }] },
    generated: {},
  });
  assert.equal(snapshot?.fragileFiles.get("src/routes/checkout.ts")?.tier, "OBSERVED");
});

test("a bare string fragile entry is ASSERTED with no evidence", () => {
  const snapshot = parseSnapshot({ manual: { fragileFiles: ["src/a.ts"] }, generated: {} });
  assert.equal(snapshot?.fragileFiles.get("src/a.ts")?.tier, "ASSERTED");
  assert.deepEqual(snapshot?.fragileFiles.get("src/a.ts")?.evidenceClaims, []);
});

test("rejects path-traversal entries while keeping valid ones", () => {
  const snapshot = parseSnapshot({
    manual: { fragileFiles: [{ path: "../outside.ts" }, { path: "src/kept.ts" }] },
    generated: {},
  });
  assert.deepEqual([...snapshot!.fragileFiles.keys()], ["src/kept.ts"]);
});

// -- parseSnapshot: coChangePatterns -----------------------------------------

test("coChangePatterns array form yields partners for member files", () => {
  const snapshot = parseSnapshot({
    manual: {
      fragileFiles: ["src/routes/checkout.ts"],
      coChangePatterns: [{ files: ["src/routes/checkout.ts", "src/auth/session.ts"], strength: 0.8 }],
    },
    generated: {},
  });
  assert.deepEqual(snapshot?.fragileFiles.get("src/routes/checkout.ts")?.coChangePartners, ["src/auth/session.ts"]);
});

test("coChangePatterns { files, strength } object form (the real workspace.json shape) yields partners", () => {
  const snapshot = parseSnapshot({
    manual: {
      fragileFiles: ["src/db/client.ts"],
      coChangePatterns: [{ files: ["src/db/client.ts", "src/db/schema.ts"], strength: 0.86 }],
    },
    generated: {},
  });
  assert.deepEqual(snapshot?.fragileFiles.get("src/db/client.ts")?.coChangePartners, ["src/db/schema.ts"]);
});

test("coChangePatterns adjacency-map form yields partners for member files", () => {
  const snapshot = parseSnapshot({
    manual: {
      fragileFiles: ["src/routes/checkout.ts"],
      coChangePatterns: { "src/routes/checkout.ts": ["src/auth/session.ts", "src/lib/format.ts"] },
    },
    generated: {},
  });
  assert.deepEqual(
    new Set(snapshot?.fragileFiles.get("src/routes/checkout.ts")?.coChangePartners),
    new Set(["src/auth/session.ts", "src/lib/format.ts"]),
  );
});

// -- parseSnapshot: fileIndex -------------------------------------------------

test("fileIndex normalizes entries and is queryable independent of fragileFiles", () => {
  const snapshot = parseSnapshot({ manual: {}, generated: { fileIndex: ["src//a.ts", 42, null] } });
  assert.equal(snapshot?.fileIndex.has("src/a.ts"), true);
  assert.equal(snapshot?.fileIndex.size, 1);
});

test("fileIndex extracts keys from the real spec's object shape (per-file behavioral intelligence keyed by path), not only the legacy array of paths", () => {
  const snapshot = parseSnapshot({
    manual: {},
    generated: { fileIndex: { "src//a.ts": { fragility: 0.8, aiModificationCount: 3 }, "src/b.ts": {} } },
  });
  assert.equal(snapshot?.fileIndex.has("src/a.ts"), true);
  assert.equal(snapshot?.fileIndex.has("src/b.ts"), true);
  assert.equal(snapshot?.fileIndex.size, 2);
});
