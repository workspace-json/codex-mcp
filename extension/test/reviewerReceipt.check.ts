import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { type ReceiptLoad, type ReviewerVerdict, loadLatestReceipt, summarizeReview } from "../src/reviewerVerdict.js";

function okLoad(verdict: "PASS" | "BLOCK", scopePaths: string[], extra: Partial<ReviewerVerdict> = {}): ReceiptLoad {
  return {
    kind: "ok",
    verdict: { status: "COMPLETED", verdict, artifactDir: "/producer/wrote/this", findings: [], evidence: [], checked: [], gaps: [], ...extra },
    receipt: { model: "gpt-5.6", scopePaths },
    dir: "/discovered/run",
  };
}

const SUBDIR = ".local/workspacejson/reviewer";

const VERDICT = {
  status: "COMPLETED",
  verdict: "PASS",
  artifactDir: "ignored",
  findings: [],
  evidence: [],
  checked: [],
  gaps: [],
};
const RECEIPT = { provider: "openai", endpoint: "https://x", model: "gpt-5.6", scopeHash: "abc123", scopePaths: ["src/a.ts"] };

async function writeRun(root: string, subdir: string, verdict: unknown, receipt: unknown | undefined, mtime: Date): Promise<void> {
  const dir = join(root, SUBDIR, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "verdict.json"), JSON.stringify(verdict));
  if (receipt !== undefined) await writeFile(join(dir, "receipt.json"), JSON.stringify(receipt));
  await utimes(join(dir, "verdict.json"), mtime, mtime);
}

async function withRoot(fn: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "reviewer-receipt-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("loadLatestReceipt: no run yields kind 'none'", async () => {
  await withRoot(async (root) => {
    assert.deepEqual(await loadLatestReceipt(root), { kind: "none" });
  });
});

test("loadLatestReceipt: verdict with a model-attributed sibling receipt validates", async () => {
  await withRoot(async (root) => {
    await writeRun(root, "run", VERDICT, RECEIPT, new Date("2030-01-01"));
    const load = await loadLatestReceipt(root);
    assert.equal(load.kind, "ok");
    if (load.kind !== "ok") return;
    assert.equal(load.receipt.model, "gpt-5.6");
    assert.deepEqual(load.receipt.scopePaths, ["src/a.ts"]);
    // The load binds to the directory the receipt was discovered in, so Inspect
    // Receipt can open it even when verdict.json carries no (or a stale) artifactDir.
    assert.equal(load.dir, join(root, SUBDIR, "run"));
  });
});

test("summarizeReview: artifactDir is the discovered dir, not the producer-written path", () => {
  // okLoad's verdict.artifactDir is "/producer/wrote/this"; the summary must
  // surface the discovered "/discovered/run" so Inspect Receipt opens the real file.
  const summary = summarizeReview(okLoad("PASS", ["src/a.ts"]), new Set(["src/a.ts"]));
  assert.equal(summary.artifactDir, "/discovered/run");
});

test("loadLatestReceipt: a verdict with no sibling receipt is invalid (missing model attribution)", async () => {
  await withRoot(async (root) => {
    await writeRun(root, "run", VERDICT, undefined, new Date("2030-01-01"));
    const load = await loadLatestReceipt(root);
    assert.equal(load.kind, "invalid");
    if (load.kind === "invalid") assert.match(load.reason, /Receipt/);
  });
});

test("loadLatestReceipt: a receipt without model attribution is invalid", async () => {
  await withRoot(async (root) => {
    await writeRun(root, "run", VERDICT, { provider: "openai", endpoint: "x" }, new Date("2030-01-01"));
    assert.equal((await loadLatestReceipt(root)).kind, "invalid");
  });
});

// -- summarizeReview: freshness / staleness (§5.2) ----------------------------

test("summarizeReview: none -> NOT_RUN, invalid -> UNAVAILABLE with a reason", () => {
  assert.equal(summarizeReview({ kind: "none" }, new Set()).state, "NOT_RUN");
  const invalid = summarizeReview({ kind: "invalid", reason: "Receipt could not be validated" }, new Set());
  assert.equal(invalid.state, "UNAVAILABLE");
  assert.equal(invalid.detail, "Receipt could not be validated");
});

test("summarizeReview: a receipt whose scope matches the current change is fresh and shows the verdict", () => {
  const summary = summarizeReview(okLoad("BLOCK", ["src/a.ts", "src/b.ts"], { findings: ["x"] }), new Set(["src/a.ts", "src/b.ts"]));
  assert.equal(summary.state, "BLOCK");
  assert.equal(summary.fresh, true);
  assert.equal(summary.model, "gpt-5.6");
});

test("summarizeReview: once the change moves past the reviewed scope the receipt is STALE, not a current verdict", () => {
  const summary = summarizeReview(okLoad("PASS", ["src/a.ts"]), new Set(["src/a.ts", "src/c.ts"]));
  assert.equal(summary.state, "STALE");
  assert.equal(summary.fresh, false);
  assert.equal(summary.verdict, "PASS"); // retained for the boundary display, not shown as current
});

test("summarizeReview: an unknown changeset cannot be claimed fresh", () => {
  assert.equal(summarizeReview(okLoad("PASS", ["src/a.ts"]), undefined).state, "STALE");
});
