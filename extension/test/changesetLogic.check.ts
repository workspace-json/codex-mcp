import assert from "node:assert/strict";
import test from "node:test";
import type { FragileFileIntelligence, IntelligenceSnapshot } from "../src/parseSnapshot.js";
import { computeChangesetFiles, deriveFileLabel, pathsFromFsPaths } from "../src/changesetLogic.js";

// -- deriveFileLabel: the A3 "DENY -> 1 missing partner -> covered" ladder --

test("deriveFileLabel: 0 missing is covered, 1 is a countdown, 2+ is DENY regardless of magnitude", () => {
  assert.equal(deriveFileLabel(0), "Partner set covered");
  assert.equal(deriveFileLabel(1), "1 missing partner");
  assert.equal(deriveFileLabel(2), "DENY");
  assert.equal(deriveFileLabel(5), "DENY");
});

// -- computeChangesetFiles ----------------------------------------------------

function fragile(path: string, coChangePartners: string[]): FragileFileIntelligence {
  return { path, tier: "ASSERTED", evidenceClaims: [], coChangePartners };
}

function snapshotWith(files: FragileFileIntelligence[]): IntelligenceSnapshot {
  return {
    fragileFiles: new Map(files.map((f) => [f.path, f])),
    fileIndex: new Set(files.map((f) => f.path)),
    coChangeGroups: [],
  };
}

test("computeChangesetFiles: undefined snapshot yields no files and no opinion", () => {
  const result = computeChangesetFiles(undefined, new Set(["a.ts"]));
  assert.deepEqual(result, { files: [], totalMissing: 0 });
});

test("computeChangesetFiles: a changeset file with two absent partners reports both as missing", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts", "c.ts"])]);
  const result = computeChangesetFiles(snapshot, new Set(["a.ts"]));
  assert.equal(result.files.length, 1);
  assert.deepEqual(result.files[0].missingPartners, ["b.ts", "c.ts"]);
  assert.equal(result.totalMissing, 2);
});

test("computeChangesetFiles: adding one partner to the changeset drops it from missingPartners (the 2->1 transition)", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts", "c.ts"])]);
  const result = computeChangesetFiles(snapshot, new Set(["a.ts", "b.ts"]));
  assert.deepEqual(result.files[0].missingPartners, ["c.ts"]);
  assert.equal(result.totalMissing, 1);
});

test("computeChangesetFiles: a fully covered file drops out of the list entirely (the 1->covered transition)", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts", "c.ts"])]);
  const result = computeChangesetFiles(snapshot, new Set(["a.ts", "b.ts", "c.ts"]));
  assert.deepEqual(result.files, []);
  assert.equal(result.totalMissing, 0);
});

test("computeChangesetFiles: files not recorded as fragile are ignored even if present in the changeset", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts"])]);
  const result = computeChangesetFiles(snapshot, new Set(["unrelated.ts"]));
  assert.deepEqual(result.files, []);
});

test("computeChangesetFiles: results are sorted deterministically by path", () => {
  const snapshot = snapshotWith([fragile("z.ts", ["p.ts"]), fragile("a.ts", ["q.ts"])]);
  const result = computeChangesetFiles(snapshot, new Set(["z.ts", "a.ts"]));
  assert.deepEqual(result.files.map((f) => f.path), ["a.ts", "z.ts"]);
});

// -- pathsFromFsPaths ----------------------------------------------------------

test("pathsFromFsPaths: keeps paths under the root, normalized, and drops paths outside it", () => {
  const result = pathsFromFsPaths("/repo", ["/repo/src/a.ts", "/repo/./src//b.ts", "/other/c.ts"]);
  assert.deepEqual([...result].sort(), ["src/a.ts", "src/b.ts"]);
});
