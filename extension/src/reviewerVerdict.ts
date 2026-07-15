import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeKey } from "./pathMatch.js";

/**
 * A completed GPT-5.6 reviewer run leaves two sibling files in its artifact
 * directory (written by the repository's MCP-side reviewer, a separate package
 * from this extension):
 *   - `verdict.json`  — the advisory verdict + what it checked / left as gaps
 *   - `receipt.json`  — the transport attribution (provider, endpoint, model)
 *                       and the reviewed scope (scopeHash + scopePaths)
 *
 * The extension reads BOTH. A verdict with no valid sibling receipt has no
 * model attribution and is therefore not a validatable receipt (§5.1, §9):
 * it is surfaced as `Reviewer unavailable`, never as a bare PASS/BLOCK.
 */
export interface ReviewerVerdict {
  status: "COMPLETED";
  verdict: "PASS" | "BLOCK";
  artifactDir: string;
  findings: string[];
  evidence: string[];
  checked: string[];
  gaps: string[];
}

/** Attribution + reviewed scope from the sibling `receipt.json`. */
export interface ReviewerReceipt {
  /** Effective model — REQUIRED for a valid receipt (§9 rejects missing model attribution). */
  model: string;
  provider?: string;
  /** Deterministic identity of the reviewed diff (§5.1 scope hash). */
  scopeHash?: string;
  /** Repo-relative changed paths that were in the reviewed diff (§5.2 staleness input). */
  scopePaths: string[];
}

/** Reviewer plane state (§2.4). A PASS is advisory, never a safety certification. */
export type ReviewState =
  | "NOT_RUN"
  | "RUNNING"
  | "PASS"
  | "BLOCK"
  | "UNKNOWN"
  | "UNAVAILABLE"
  | "FAILED"
  | "STALE";

/** The already-validated, renderer-facing reviewer summary. No renderer re-parses a receipt (§1.5). */
export interface ReviewSummary {
  state: ReviewState;
  /** Underlying advisory verdict, retained even when state is STALE so the boundary stays visible (§5.4). */
  verdict?: "PASS" | "BLOCK";
  model?: string;
  provider?: string;
  scopeHash?: string;
  reviewedCount?: number;
  /** True only when the reviewed scope matches the current changeset (§5.2). */
  fresh: boolean;
  findings: string[];
  gaps: string[];
  artifactDir?: string;
  /** Concise reason for UNAVAILABLE/FAILED — e.g. "Receipt could not be validated". */
  detail?: string;
}

/** Discriminated load result so "no run" and "invalid receipt" stay distinct (§6.2). */
export type ReceiptLoad =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "ok"; verdict: ReviewerVerdict; receipt: ReviewerReceipt };

const VERDICT_DIR = ".local/workspacejson/reviewer";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function normalizePaths(paths: string[]): string[] {
  return paths.map(normalizeKey).filter((p) => p.length > 0 && !p.startsWith("../") && !p.startsWith("/"));
}

function parseVerdict(raw: unknown): ReviewerVerdict | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.status !== "COMPLETED") return undefined;
  if (r.verdict !== "PASS" && r.verdict !== "BLOCK") return undefined;
  const artifactDir = typeof r.artifactDir === "string" ? r.artifactDir : "";
  if (!isStringArray(r.findings) || !isStringArray(r.evidence) || !isStringArray(r.checked) || !isStringArray(r.gaps))
    return undefined;
  return {
    status: "COMPLETED",
    verdict: r.verdict,
    artifactDir,
    findings: r.findings,
    evidence: r.evidence,
    checked: normalizePaths(r.checked),
    gaps: normalizePaths(r.gaps),
  };
}

/** Parse the sibling receipt. Missing/empty model attribution makes the receipt invalid, not merely sparse. */
function parseReceipt(raw: unknown): ReviewerReceipt | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const model = typeof r.model === "string" ? r.model.trim() : "";
  if (!model) return undefined;
  return {
    model,
    provider: typeof r.provider === "string" ? r.provider : undefined,
    scopeHash: typeof r.scopeHash === "string" && r.scopeHash ? r.scopeHash : undefined,
    scopePaths: isStringArray(r.scopePaths) ? normalizePaths(r.scopePaths) : [],
  };
}

async function findVerdictFiles(rootPath: string): Promise<string[]> {
  const dir = join(rootPath, VERDICT_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir, { recursive: true });
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith("verdict.json")).map((name) => join(dir, name));
}

/** Newest verdict file by mtime (artifactDir is caller-overridable, so name-sorting is unsafe). */
async function newestVerdictPath(rootPath: string): Promise<string | undefined> {
  const files = await findVerdictFiles(rootPath);
  let newest: { path: string; mtime: number } | undefined;
  for (const path of files) {
    try {
      const stat = await fs.stat(path);
      if (!newest || stat.mtimeMs > newest.mtime) newest = { path, mtime: stat.mtimeMs };
    } catch {
      // ignore unreadable entries
    }
  }
  return newest?.path;
}

/**
 * Back-compat helper retained for callers/tests that only need the raw
 * advisory verdict. Prefer {@link loadLatestReceipt} for anything user-facing,
 * which also enforces sibling model attribution.
 */
export async function findLatestVerdict(rootPath: string): Promise<ReviewerVerdict | undefined> {
  const path = await newestVerdictPath(rootPath);
  if (!path) return undefined;
  try {
    return parseVerdict(JSON.parse(await fs.readFile(path, "utf8")));
  } catch {
    return undefined;
  }
}

/**
 * Load the newest reviewer artifact as a validated receipt: verdict.json plus
 * its sibling receipt.json. Distinguishes "never run" from "found but invalid"
 * so the UI can honestly show `Not run` vs `Reviewer unavailable` (§5.3, §6.2).
 */
export async function loadLatestReceipt(rootPath: string): Promise<ReceiptLoad> {
  const path = await newestVerdictPath(rootPath);
  if (!path) return { kind: "none" };

  let verdict: ReviewerVerdict | undefined;
  try {
    verdict = parseVerdict(JSON.parse(await fs.readFile(path, "utf8")));
  } catch {
    verdict = undefined;
  }
  if (!verdict) return { kind: "invalid", reason: "Verdict could not be validated" };

  let receipt: ReviewerReceipt | undefined;
  try {
    receipt = parseReceipt(JSON.parse(await fs.readFile(join(dirname(path), "receipt.json"), "utf8")));
  } catch {
    receipt = undefined;
  }
  if (!receipt) return { kind: "invalid", reason: "Receipt could not be validated" };

  return { kind: "ok", verdict, receipt };
}

/**
 * Fold a load result and the current changeset into the renderer-facing
 * summary. Freshness (§5.2) is honest: a receipt is fresh only when its
 * reviewed path set is known and exactly matches the current changeset. When
 * the changeset is unknown or has moved, the verdict is retained but marked
 * STALE — never shown as a current PASS/BLOCK.
 */
export function summarizeReview(load: ReceiptLoad, changeset: ReadonlySet<string> | undefined): ReviewSummary {
  if (load.kind === "none") return { state: "NOT_RUN", fresh: false, findings: [], gaps: [] };
  if (load.kind === "invalid")
    return { state: "UNAVAILABLE", fresh: false, findings: [], gaps: [], detail: load.reason };

  const { verdict, receipt } = load;
  const fresh = isFresh(receipt.scopePaths, changeset);
  const base: ReviewSummary = {
    state: fresh ? verdict.verdict : "STALE",
    verdict: verdict.verdict,
    model: receipt.model,
    provider: receipt.provider,
    scopeHash: receipt.scopeHash,
    reviewedCount: receipt.scopePaths.length,
    fresh,
    findings: verdict.findings,
    gaps: verdict.gaps,
    artifactDir: verdict.artifactDir,
  };
  if (!fresh) base.detail = "change has moved";
  return base;
}

function isFresh(scopePaths: string[], changeset: ReadonlySet<string> | undefined): boolean {
  if (changeset === undefined) return false; // git state unknown — cannot claim currency
  if (scopePaths.length === 0) return false; // no recorded scope — cannot confirm currency
  if (scopePaths.length !== changeset.size) return false;
  return scopePaths.every((p) => changeset.has(p));
}
