import assert from "node:assert/strict";
import test from "node:test";
import { changeRoleFor } from "../src/changesetLogic.js";
import type { IntelligenceSnapshot } from "../src/parseSnapshot.js";
import type { ReviewSummary } from "../src/reviewerVerdict.js";
import type { SourceState } from "../src/semanticModel.js";
import { deriveView } from "../src/semanticModel.js";
import { statusText } from "../src/tooltips.js";
import { buildTree, omissionBadge } from "../src/treeModel.js";

/**
 * The submission-critical guarantee: every native surface is a thin renderer of
 * ONE immutable view (§1.1). This walks the defining 2 → 1 → covered product
 * moment and asserts the status bar, the tree badge, and the Explorer decision
 * role all move together, derived from the same snapshot + changeset. If any
 * surface could disagree, this fails.
 */

const CHECKOUT = "src/routes/checkout.ts";
const SESSION = "src/auth/session.ts";
const FORMAT = "src/lib/format.ts";

const AVAILABLE: SourceState = { path: ".agents/workspace.json", availability: "AVAILABLE" };
const NO_REVIEW: ReviewSummary = { state: "NOT_RUN", fresh: false, findings: [], gaps: [] };
const snapshot: IntelligenceSnapshot = {
  fragileFiles: new Map([[CHECKOUT, { path: CHECKOUT, tier: "OBSERVED", evidenceClaims: ["payment edge cases"], coChangePartners: [SESSION, FORMAT] }]]),
  fileIndex: new Set(),
  coChangeGroups: [],
};

function surfaces(change: Set<string>) {
  const view = deriveView({ snapshot, source: AVAILABLE, changeset: change, review: NO_REVIEW });
  return {
    decision: view.currentChange.decision,
    status: statusText(view),
    badge: omissionBadge(view)?.value,
    treeKinds: buildTree(view).map((n) => n.kind),
    role: (p: string) => changeRoleFor(snapshot, change, p)?.role,
  };
}

test("2 → 1 → covered stays coherent across status bar, tree badge, and Explorer role from one model", () => {
  // 2 omitted — the governing DENY.
  let s = surfaces(new Set([CHECKOUT]));
  assert.equal(s.decision, "DENY");
  assert.equal(s.status, "$(error) workspace.json · 2 omitted");
  assert.equal(s.badge, 2);
  assert.ok(s.treeKinds.includes("decisionFile"));
  assert.equal(s.role(CHECKOUT), "denied");
  assert.equal(s.role(SESSION), "omitted");
  assert.equal(s.role(FORMAT), "omitted");

  // 1 omitted — include session.ts; it flips omitted → included, the count drops.
  s = surfaces(new Set([CHECKOUT, SESSION]));
  assert.equal(s.decision, "DENY");
  assert.equal(s.status, "$(error) workspace.json · 1 omitted");
  assert.equal(s.badge, 1);
  assert.equal(s.role(SESSION), "included");
  assert.equal(s.role(FORMAT), "omitted");

  // covered — include format.ts; no more omissions, and no surface claims "safe".
  s = surfaces(new Set([CHECKOUT, SESSION, FORMAT]));
  assert.equal(s.decision, "PARTNER_SET_COVERED");
  assert.equal(s.status, "$(checklist) workspace.json · verify");
  assert.equal(s.badge, undefined);
  assert.ok(s.treeKinds.includes("covered"));
  assert.notEqual(s.role(CHECKOUT), "denied");
});
