import assert from "node:assert/strict";
import test from "node:test";
import type { FragileFileIntelligence, IntelligenceSnapshot } from "../src/parseSnapshot.js";
import type { ReviewState, ReviewSummary } from "../src/reviewerVerdict.js";
import { type SourceState, deriveView } from "../src/semanticModel.js";
import { type PlainNode, buildChangeNodes, buildTree, omissionBadge, reviewLabel, viewStateFor } from "../src/treeModel.js";

const PROHIBITED = ["SAFE", "ALL CLEAR", "APPROVED", "GUARANTEED", "REQUIRED FILES"];
const AVAILABLE: SourceState = { path: ".agents/workspace.json", availability: "AVAILABLE" };
const NO_REVIEW: ReviewSummary = { state: "NOT_RUN", fresh: false, findings: [], gaps: [] };

function fragile(path: string, partners: string[]): FragileFileIntelligence {
  return { path, tier: "OBSERVED", evidenceClaims: ["recorded"], coChangePartners: partners };
}
function snapshotWith(files: FragileFileIntelligence[]): IntelligenceSnapshot {
  return { fragileFiles: new Map(files.map((f) => [f.path, f])), fileIndex: new Set(), coChangeGroups: [] };
}
function viewFor(source: SourceState, snapshot: IntelligenceSnapshot | undefined, changeset: Set<string> | undefined, review = NO_REVIEW) {
  return deriveView({ snapshot, source, changeset, review });
}
function flatten(nodes: PlainNode[]): PlainNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
}
function assertClean(nodes: PlainNode[]): void {
  for (const node of flatten(nodes)) {
    const text = `${node.label} ${node.description ?? ""}`.toUpperCase();
    for (const banned of PROHIBITED)
      assert.ok(!new RegExp(`\\b${banned}\\b`).test(text), `node rendered prohibited term "${banned}": ${node.label}`);
  }
}

test("DENY change renders a decision row → a causal omission line → an omitted-partner child per partner", () => {
  const v = viewFor(AVAILABLE, snapshotWith([fragile("src/routes/checkout.ts", ["src/auth/session.ts", "src/lib/format.ts"])]), new Set(["src/routes/checkout.ts"]));
  const nodes = buildChangeNodes(v);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].kind, "decisionFile");
  assert.equal(nodes[0].label, "DENY · checkout.ts");
  assert.equal(nodes[0].description, "src/routes");
  // One causal line gives the nested partners their meaning.
  const omission = nodes[0].children?.[0];
  assert.equal(omission?.kind, "omissionCount");
  assert.equal(omission?.label, "2 evidenced partners omitted");
  assert.equal(omission?.children?.length, 2);
  const partner = omission?.children?.[0];
  assert.equal(partner?.kind, "partner");
  assert.equal(partner?.label, "session.ts");
  // "omitted", never "absent": the file exists, it is just not in the change.
  assert.match(partner?.description ?? "", /omitted$/);
  assert.doesNotMatch(partner?.description ?? "", /absent/);
});

test("viewStateFor: availability and change map to the right welcome/active state", () => {
  const snap = snapshotWith([fragile("a.ts", ["b.ts"])]);
  const failed: SourceState = { path: ".agents/workspace.json", availability: "FAILED", error: "malformed" };
  const gone: SourceState = { path: ".agents/workspace.json", availability: "UNAVAILABLE" };
  assert.equal(viewStateFor(viewFor(failed, snap, new Set(["a.ts"]))), "malformed");
  assert.equal(viewStateFor(viewFor(gone, snap, new Set(["a.ts"]))), "noEvidence");
  assert.equal(viewStateFor(viewFor(AVAILABLE, snap, new Set())), "noChange"); // available, nothing changed
  assert.equal(viewStateFor(viewFor(AVAILABLE, snap, undefined)), "noChange"); // git unknown
  assert.equal(viewStateFor(viewFor(AVAILABLE, snap, new Set(["a.ts"]))), "active"); // DENY
});

test("covered state always carries the verification requirement (§4.2, §9)", () => {
  const v = viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts"])]), new Set(["a.ts", "b.ts"]));
  const covered = buildChangeNodes(v)[0];
  assert.equal(covered.kind, "covered");
  assert.equal(covered.label, "Partner set covered");
  assert.equal(covered.description, "Verification still required");
});

test("omissionBadge counts actionable omissions and pluralizes honestly", () => {
  const two = viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts", "c.ts"])]), new Set(["a.ts"]));
  assert.deepEqual(omissionBadge(two), { value: 2, tooltip: "2 evidenced partner omissions" });
  const one = viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts"])]), new Set(["a.ts"]));
  assert.equal(omissionBadge(one)?.tooltip, "1 evidenced partner omission");
  const covered = viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts"])]), new Set(["a.ts", "b.ts"]));
  assert.equal(omissionBadge(covered), undefined);
});

test("a malformed source renders an explicit unavailable node, not an empty change (§6.2)", () => {
  const failed: SourceState = { path: ".agents/workspace.json", availability: "FAILED", error: "malformed" };
  const nodes = buildChangeNodes(viewFor(failed, undefined, new Set(["a.ts"])));
  assert.equal(nodes[0].kind, "sourceFailed");
  assert.match(nodes[0].label, /unavailable/i);
});

test("a missing source renders Evidence unavailable", () => {
  const missing: SourceState = { path: ".agents/workspace.json", availability: "UNAVAILABLE" };
  assert.equal(buildChangeNodes(viewFor(missing, undefined, new Set()))[0].label, "Evidence unavailable");
});

test("an unknown Git changeset renders Current change unavailable", () => {
  const nodes = buildChangeNodes(viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts"])]), undefined));
  assert.equal(nodes[0].kind, "changeUnknown");
});

test("buildTree always appends a REVIEW plane node", () => {
  const nodes = buildTree(viewFor(AVAILABLE, snapshotWith([]), new Set()));
  assert.equal(nodes.at(-1)?.id, "review");
  assert.equal(nodes.at(-1)?.label, "REVIEW");
});

test("no rendered node in any decision/review state contains a prohibited safety term", () => {
  const states: ReviewState[] = ["NOT_RUN", "RUNNING", "PASS", "BLOCK", "STALE", "UNAVAILABLE", "FAILED", "UNKNOWN"];
  for (const state of states) {
    const review: ReviewSummary = { state, verdict: state === "PASS" ? "PASS" : undefined, fresh: state === "PASS", findings: [], gaps: [], model: "gpt-5.6" };
    assertClean(buildTree(viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts"])]), new Set(["a.ts"]), review)));
  }
  assertClean(buildTree(viewFor(AVAILABLE, snapshotWith([fragile("a.ts", ["b.ts"])]), new Set(["a.ts", "b.ts"]))));
  for (const state of states) assert.ok(!PROHIBITED.some((p) => reviewLabel(state).toUpperCase().includes(p)));
});
