import assert from "node:assert/strict";
import test from "node:test";
import type { ChangesetFile } from "../src/changesetLogic.js";
import { TRUSTED_TOOLTIP_COMMANDS } from "../src/commandIds.js";
import type { ReviewSummary } from "../src/reviewerVerdict.js";
import type { SourceState } from "../src/semanticModel.js";
import { deriveView } from "../src/semanticModel.js";
import {
  coveredTooltip,
  decisionTooltip,
  partnerTooltip,
  reviewTooltip,
  statusText,
  statusTooltip,
} from "../src/tooltips.js";

const PROHIBITED = ["SAFE", "ALL CLEAR", "APPROVED", "GUARANTEED", "REQUIRED FILES"];
const AVAILABLE: SourceState = { path: ".agents/workspace.json", availability: "AVAILABLE" };

function changesetFile(): ChangesetFile {
  return {
    path: "src/routes/checkout.ts",
    file: { path: "src/routes/checkout.ts", tier: "OBSERVED", evidenceClaims: ["payment edge cases"], coChangePartners: ["src/auth/session.ts", "src/lib/format.ts"] },
    missingPartners: ["src/auth/session.ts", "src/lib/format.ts"],
  };
}

function assertNoProhibited(text: string): void {
  // Whole-token match: the spec bans the standalone labels SAFE/APPROVED/... ,
  // not incidental substrings like "safety" inside ordinary prose.
  const upper = text.toUpperCase();
  for (const banned of PROHIBITED)
    assert.ok(!new RegExp(`\\b${banned}\\b`).test(upper), `tooltip contained prohibited term "${banned}"`);
}

/** Every command link in a trusted tooltip must reference an allowlisted command (§4.3, §7). */
function assertOnlyAllowlistedCommands(text: string): void {
  const matches = [...text.matchAll(/command:([\w.]+)/g)].map((m) => m[1]);
  for (const command of matches) assert.ok(TRUSTED_TOOLTIP_COMMANDS.includes(command), `tooltip linked non-allowlisted command ${command}`);
}

test("decisionTooltip: names the file, lists absent partners, keeps the advisory-free next action", () => {
  const md = decisionTooltip(changesetFile());
  assert.match(md, /Change denied/);
  assert.match(md, /src\/routes\/checkout\.ts/);
  assert.match(md, /src\/auth\/session\.ts/);
  assert.match(md, /Run verification/);
  assertNoProhibited(md);
  assertOnlyAllowlistedCommands(md);
});

test("partnerTooltip: describes a partner omitted from the current change (the file exists)", () => {
  const md = partnerTooltip("src/auth/session.ts", changesetFile());
  assert.match(md, /Evidenced partner omitted/);
  assert.match(md, /co-change partner/i);
  assert.match(md, /Not in the current change/);
  assert.doesNotMatch(md, /\babsent\b/i); // "absent" wrongly implies a missing file
  assertNoProhibited(md);
  assertOnlyAllowlistedCommands(md);
});

test("coveredTooltip: ALWAYS states that verification is still required (§4.2, §9)", () => {
  const md = coveredTooltip();
  assert.match(md, /Verification is still required/);
  assertNoProhibited(md);
  assertOnlyAllowlistedCommands(md);
});

test("reviewTooltip: leads with the deterministic decision, keeps the advisory result subordinate and scoped (§5.4)", () => {
  const review: ReviewSummary = {
    state: "BLOCK",
    verdict: "BLOCK",
    model: "gpt-5.6",
    reviewedCount: 3,
    scopeHash: "abcdef0123456789",
    fresh: true,
    findings: ["missing partner"],
    gaps: ["tests not run"],
  };
  // a.ts is fragile with partner b.ts; a change of a.ts alone is a deterministic DENY.
  const md = reviewTooltip(view(AVAILABLE, new Set(["a.ts"]), review));
  assert.match(md, /gpt-5\.6/);
  assert.match(md, /Deterministic decision: \*\*DENY\*\*/);
  assert.match(md, /Advisory result: \*\*BLOCK\*\* within reviewed scope/);
  assert.match(md, /Scope: 3 paths · Fresh/);
  assert.match(md, /tests not run/);
  assert.doesNotMatch(md, /abcdef0123456789/); // scope-id hash belongs in the receipt, not the hover
  assertNoProhibited(md);
  assertOnlyAllowlistedCommands(md);
});

test("reviewTooltip: PASS is presented as scope-bounded, never an unqualified pass", () => {
  const review: ReviewSummary = { state: "PASS", verdict: "PASS", model: "gpt-5.6", reviewedCount: 1, fresh: true, findings: [], gaps: ["no test evidence"] };
  const md = reviewTooltip(view(AVAILABLE, new Set(["a.ts"]), review));
  assert.match(md, /Advisory result: \*\*PASS within reviewed scope\*\*/);
  assert.match(md, /Scope: 1 path · Fresh/);
  assert.match(md, /Gap: no test evidence/);
  assertNoProhibited(md);
});

test("reviewTooltip: a stale receipt never presents as a current PASS", () => {
  const review: ReviewSummary = { state: "STALE", verdict: "PASS", model: "gpt-5.6", reviewedCount: 1, fresh: false, findings: [], gaps: [], detail: "change has moved" };
  const md = reviewTooltip(view(AVAILABLE, new Set(["a.ts"]), review));
  assert.match(md, /stale/i);
  assert.match(md, /change has moved/);
  assert.doesNotMatch(md, /PASS within reviewed scope/);
});

// -- status bar text ----------------------------------------------------------

function view(source: SourceState, changeset: Set<string> | undefined, review: ReviewSummary) {
  const snapshot = {
    fragileFiles: new Map([["a.ts", { path: "a.ts", tier: "OBSERVED" as const, evidenceClaims: ["x"], coChangePartners: ["b.ts"] }]]),
    fileIndex: new Set<string>(),
    coChangeGroups: [],
  };
  return deriveView({ snapshot, source, changeset, review });
}

const NO_REVIEW: ReviewSummary = { state: "NOT_RUN", fresh: false, findings: [], gaps: [] };

test("statusText: DENY shows the omission count; covered shows verify; idle hides", () => {
  assert.equal(statusText(view(AVAILABLE, new Set(["a.ts"]), NO_REVIEW)), "$(error) workspace.json · 1 omitted");
  assert.equal(statusText(view(AVAILABLE, new Set(["a.ts", "b.ts"]), NO_REVIEW)), "$(checklist) workspace.json · verify");
  assert.equal(statusText(view(AVAILABLE, new Set(), NO_REVIEW)), undefined);
});

test("statusText: an unavailable source reports unavailable, never a fabricated clear state", () => {
  const failed: SourceState = { path: ".agents/workspace.json", availability: "FAILED", error: "malformed" };
  assert.equal(statusText(view(failed, undefined, NO_REVIEW)), "$(question) workspace.json · unavailable");
  assertNoProhibited(statusTooltip(view(failed, undefined, NO_REVIEW)));
});
