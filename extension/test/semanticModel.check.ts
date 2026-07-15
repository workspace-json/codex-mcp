import assert from "node:assert/strict";
import test from "node:test";
import type { FragileFileIntelligence, IntelligenceSnapshot } from "../src/parseSnapshot.js";
import type { ReviewSummary } from "../src/reviewerVerdict.js";
import { type SourceState, deriveDecision, deriveView } from "../src/semanticModel.js";
import { computeChangesetFiles } from "../src/changesetLogic.js";

function fragile(path: string, coChangePartners: string[], tier: "ASSERTED" | "OBSERVED" = "ASSERTED"): FragileFileIntelligence {
  return { path, tier, evidenceClaims: tier === "OBSERVED" ? ["recorded"] : [], coChangePartners };
}

function snapshotWith(files: FragileFileIntelligence[]): IntelligenceSnapshot {
  return {
    fragileFiles: new Map(files.map((f) => [f.path, f])),
    fileIndex: new Set(files.map((f) => f.path)),
    coChangeGroups: [],
  };
}

const AVAILABLE: SourceState = { path: ".agents/workspace.json", availability: "AVAILABLE" };
const NO_REVIEW: ReviewSummary = { state: "NOT_RUN", fresh: false, findings: [], gaps: [] };

function view(snapshot: IntelligenceSnapshot | undefined, changeset: Set<string> | undefined, source = AVAILABLE) {
  return deriveView({ snapshot, source, changeset, review: NO_REVIEW });
}

// -- deriveDecision: total, tier-independent policy ---------------------------

test("deriveDecision: any recorded omission is DENY (mirrors the deterministic hook)", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts"])]);
  const { files } = computeChangesetFiles(snapshot, new Set(["a.ts"]));
  assert.equal(deriveDecision(files, 1, 1), "DENY");
});

test("deriveDecision: fragile in change, all partners present is PARTNER_SET_COVERED", () => {
  assert.equal(deriveDecision([], 1, 1), "PARTNER_SET_COVERED");
});

test("deriveDecision: fragile in change with no partners at all is ANNOTATE", () => {
  assert.equal(deriveDecision([], 1, 0), "ANNOTATE");
});

test("deriveDecision: no fragile file in the change is IDLE", () => {
  assert.equal(deriveDecision([], 0, 0), "IDLE");
});

// -- deriveView: the assessment plane ----------------------------------------

test("deriveView: a fragile file with an absent partner denies and reports the omission count", () => {
  const v = view(snapshotWith([fragile("a.ts", ["b.ts", "c.ts"])]), new Set(["a.ts"]));
  assert.equal(v.currentChange.decision, "DENY");
  assert.equal(v.currentChange.missingCount, 2);
  assert.equal(v.currentChange.files.length, 1);
});

test("deriveView: covering the last partner transitions to PARTNER_SET_COVERED with zero omissions", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts"])]);
  assert.equal(view(snapshot, new Set(["a.ts", "b.ts"])).currentChange.decision, "PARTNER_SET_COVERED");
});

// -- §9 invariant: the semantic planes are independent ------------------------

test("deriveView: flipping a file's evidence tier does NOT change the decision", () => {
  const asserted = view(snapshotWith([fragile("a.ts", ["b.ts"], "ASSERTED")]), new Set(["a.ts"]));
  const observed = view(snapshotWith([fragile("a.ts", ["b.ts"], "OBSERVED")]), new Set(["a.ts"]));
  assert.equal(asserted.currentChange.decision, observed.currentChange.decision);
});

test("deriveView: a reviewer verdict never changes the deterministic decision", () => {
  const snapshot = snapshotWith([fragile("a.ts", ["b.ts"])]);
  const blocking: ReviewSummary = { state: "BLOCK", verdict: "BLOCK", fresh: true, findings: [], gaps: [], model: "gpt-5.6" };
  const passing: ReviewSummary = { state: "PASS", verdict: "PASS", fresh: true, findings: [], gaps: [], model: "gpt-5.6" };
  const withBlock = deriveView({ snapshot, source: AVAILABLE, changeset: new Set(["a.ts"]), review: blocking });
  const withPass = deriveView({ snapshot, source: AVAILABLE, changeset: new Set(["a.ts"]), review: passing });
  assert.equal(withBlock.currentChange.decision, "DENY");
  assert.equal(withPass.currentChange.decision, "DENY");
});

// -- §6.2 invariant: unavailability never manufactures evidence or a decision -

test("deriveView: a FAILED source yields no files and an IDLE (non-manufactured) decision", () => {
  const failed: SourceState = { path: ".agents/workspace.json", availability: "FAILED", error: "malformed" };
  const v = deriveView({ snapshot: undefined, source: failed, changeset: new Set(["a.ts"]), review: NO_REVIEW });
  assert.equal(v.currentChange.decision, "IDLE");
  assert.equal(v.currentChange.files.length, 0);
  assert.equal(v.source.availability, "FAILED");
});

test("deriveView: an unknown Git changeset is reported as not-known, not as an empty change", () => {
  const v = view(snapshotWith([fragile("a.ts", ["b.ts"])]), undefined);
  assert.equal(v.currentChange.changesetKnown, false);
  assert.equal(v.currentChange.decision, "IDLE");
});
