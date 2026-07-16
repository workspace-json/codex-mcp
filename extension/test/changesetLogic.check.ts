import assert from "node:assert/strict";
import test from "node:test";
import type { FragileFileIntelligence, IntelligenceSnapshot } from "../src/parseSnapshot.js";
import { changeRoleFor, computeChangesetFiles, findDeepestRepoRoot, pathsFromFsPaths, RepoBinder } from "../src/changesetLogic.js";

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

// -- changeRoleFor: the decision-oriented Explorer role --------------------------

test("changeRoleFor: the denied file, an omitted partner, and an unrelated file get distinct roles", () => {
  const snapshot = snapshotWith([fragile("src/routes/checkout.ts", ["src/auth/session.ts", "src/lib/format.ts"])]);
  const change = new Set(["src/routes/checkout.ts"]);
  assert.deepEqual(changeRoleFor(snapshot, change, "src/routes/checkout.ts"), { role: "denied", missingCount: 2, tier: "ASSERTED" });
  assert.deepEqual(changeRoleFor(snapshot, change, "src/auth/session.ts"), { role: "omitted", parent: "src/routes/checkout.ts", tier: "ASSERTED" });
  assert.equal(changeRoleFor(snapshot, change, "README.md"), undefined);
});

test("changeRoleFor: including a partner flips it omitted → included and lowers the denied count (2 → 1)", () => {
  const snapshot = snapshotWith([fragile("src/routes/checkout.ts", ["src/auth/session.ts", "src/lib/format.ts"])]);
  const change = new Set(["src/routes/checkout.ts", "src/auth/session.ts"]);
  assert.deepEqual(changeRoleFor(snapshot, change, "src/auth/session.ts"), { role: "included", parent: "src/routes/checkout.ts" });
  assert.deepEqual(changeRoleFor(snapshot, change, "src/routes/checkout.ts"), { role: "denied", missingCount: 1, tier: "ASSERTED" });
  assert.deepEqual(changeRoleFor(snapshot, change, "src/lib/format.ts"), { role: "omitted", parent: "src/routes/checkout.ts", tier: "ASSERTED" });
});

test("changeRoleFor: once all partners are included the change is no longer denied (1 → covered)", () => {
  const snapshot = snapshotWith([fragile("src/routes/checkout.ts", ["src/auth/session.ts", "src/lib/format.ts"])]);
  const change = new Set(["src/routes/checkout.ts", "src/auth/session.ts", "src/lib/format.ts"]);
  assert.notEqual(changeRoleFor(snapshot, change, "src/routes/checkout.ts")?.role, "denied");
  assert.deepEqual(changeRoleFor(snapshot, change, "src/auth/session.ts"), { role: "included", parent: "src/routes/checkout.ts" });
});

// -- pathsFromFsPaths ----------------------------------------------------------

test("pathsFromFsPaths: keeps paths under the root, normalized, and drops paths outside it", () => {
  const result = pathsFromFsPaths("/repo", ["/repo/src/a.ts", "/repo/./src//b.ts", "/other/c.ts"]);
  assert.deepEqual([...result].sort(), ["src/a.ts", "src/b.ts"]);
});

// -- findDeepestRepoRoot --------------------------------------------------------

test("findDeepestRepoRoot: a nested repo wins over its ancestor even when the ancestor is listed first (the regression case)", () => {
  const candidates = [
    { rootPath: "/repo", value: "outer" },
    { rootPath: "/repo/vendor/nested", value: "inner" },
  ];
  assert.equal(findDeepestRepoRoot(candidates, "/repo/vendor/nested/src/a.ts"), "inner");
});

test("findDeepestRepoRoot: order independence — the same nested repo still wins when listed first", () => {
  const candidates = [
    { rootPath: "/repo/vendor/nested", value: "inner" },
    { rootPath: "/repo", value: "outer" },
  ];
  assert.equal(findDeepestRepoRoot(candidates, "/repo/vendor/nested/src/a.ts"), "inner");
});

test("findDeepestRepoRoot: a target outside the nested repo still binds to the outer repo", () => {
  const candidates = [
    { rootPath: "/repo", value: "outer" },
    { rootPath: "/repo/vendor/nested", value: "inner" },
  ];
  assert.equal(findDeepestRepoRoot(candidates, "/repo/src/a.ts"), "outer");
});

test("findDeepestRepoRoot: no matching root returns undefined", () => {
  const candidates = [{ rootPath: "/repo", value: "outer" }];
  assert.equal(findDeepestRepoRoot(candidates, "/elsewhere/a.ts"), undefined);
});

test("findDeepestRepoRoot: an exact root match (the folder IS the repo root) matches", () => {
  const candidates = [{ rootPath: "/repo", value: "outer" }];
  assert.equal(findDeepestRepoRoot(candidates, "/repo"), "outer");
});

// -- RepoBinder ------------------------------------------------------------------

test("RepoBinder: a more specific repo taking over disposes the previous binding's listener (the stale-listener regression)", () => {
  const disposed: string[] = [];
  const binder = new RepoBinder<{ dispose(): void }>("/repo/vendor/nested/src/a.ts");

  const boundOuter = binder.tryBind("/repo", () => ({ dispose: () => disposed.push("outer") }));
  assert.equal(boundOuter, true);
  assert.equal(binder.boundRootPath, "/repo");
  assert.equal(disposed.length, 0);

  const boundInner = binder.tryBind("/repo/vendor/nested", () => ({ dispose: () => disposed.push("inner") }));
  assert.equal(boundInner, true);
  assert.equal(binder.boundRootPath, "/repo/vendor/nested");
  // Without disposing "outer" here, its listener stays live and can later
  // fire and silently overwrite the more specific "inner" binding's state.
  assert.deepEqual(disposed, ["outer"]);
});

test("RepoBinder: a less specific repo opening later is rejected without touching the current binding", () => {
  const disposed: string[] = [];
  const binder = new RepoBinder<{ dispose(): void }>("/repo/vendor/nested/src/a.ts");
  binder.tryBind("/repo/vendor/nested", () => ({ dispose: () => disposed.push("inner") }));

  const boundOuter = binder.tryBind("/repo", () => ({ dispose: () => disposed.push("outer-attempt") }));
  assert.equal(boundOuter, false);
  assert.equal(binder.boundRootPath, "/repo/vendor/nested");
  assert.equal(disposed.length, 0);
});

test("RepoBinder: a repo reopening at the SAME already-bound root still rebinds (the git.enabled-toggle regression)", () => {
  const disposed: string[] = [];
  const binder = new RepoBinder<{ dispose(): void }>("/repo/a.ts");

  const first = binder.tryBind("/repo", () => ({ dispose: () => disposed.push("first") }));
  assert.equal(first, true);
  assert.equal(disposed.length, 0);

  // Git can hand back a fresh Repository object for a root already bound
  // (e.g. disabling then re-enabling git.enabled). Equal specificity must
  // still rebind — rejecting it here would freeze state on the old, possibly
  // dead listener until a full window reload.
  const second = binder.tryBind("/repo", () => ({ dispose: () => disposed.push("second") }));
  assert.equal(second, true);
  assert.equal(binder.boundRootPath, "/repo");
  assert.deepEqual(disposed, ["first"]);
});

test("RepoBinder: dispose() tears down whatever is currently bound", () => {
  const disposed: string[] = [];
  const binder = new RepoBinder<{ dispose(): void }>("/repo/a.ts");
  binder.tryBind("/repo", () => ({ dispose: () => disposed.push("bound") }));
  binder.dispose();
  assert.deepEqual(disposed, ["bound"]);
});
