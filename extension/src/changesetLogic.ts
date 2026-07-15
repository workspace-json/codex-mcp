import type { FragileFileIntelligence, IntelligenceSnapshot } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";
import type { ReviewerVerdict } from "./reviewerVerdict.js";

/**
 * Pure changeset/tree logic shared by workspaceIntelligence.ts and
 * changesetTreeProvider.ts, kept vscode-import-free so it can be unit
 * tested directly under plain `node --test` (the extension host is not
 * available there; see test/intelligence.check.ts for the same pattern
 * with parseSnapshot.ts/pathMatch.ts).
 */

export interface ChangesetFile {
  path: string;
  file: FragileFileIntelligence;
  /** Co-change partners that are NOT currently in the changeset. */
  missingPartners: string[];
}

/**
 * Derive the fragile files in the current changeset that have at least one
 * missing co-change partner, deterministically ordered by path.
 */
export function computeChangesetFiles(
  snapshot: IntelligenceSnapshot | undefined,
  changeset: ReadonlySet<string>,
): { files: ChangesetFile[]; totalMissing: number } {
  const files: ChangesetFile[] = [];
  let totalMissing = 0;
  if (!snapshot) return { files, totalMissing };

  for (const path of changeset) {
    const fragile = snapshot.fragileFiles.get(path);
    if (!fragile) continue;
    const missingPartners = fragile.coChangePartners.filter((p) => !changeset.has(p));
    if (missingPartners.length > 0) {
      files.push({ path, file: fragile, missingPartners });
      totalMissing += missingPartners.length;
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, totalMissing };
}

/**
 * Tree-node label for a changeset file's missing-partner state:
 *   0        -> "Partner set covered" (the caller filters these out of the
 *                per-file loop today, but the function stays correct
 *                standalone rather than assuming that invariant)
 *   1        -> "1 missing partner" (a countdown — close to done)
 *   2+       -> "DENY" (a blunt UI escalation once multiple partners are
 *                missing — NOT a restatement of the deterministic hook's
 *                actual decision, which denies on ANY missing partner
 *                including exactly one; see tests/unit/*.test.ts "deny
 *                holds" cases in the root package. This label is UI-only
 *                urgency signaling, not a claim of hook parity.)
 *
 * Deliberately NOT a function of the advisory GPT-5.6 verdict: per the
 * META-117 block/approval asymmetry, the model never labels or drives the
 * mechanical decision — only the changeset's own missing-partner count
 * does. The verdict is surfaced separately as an informational tooltip
 * annotation (see changesetTreeProvider.ts) — never as a label driver.
 */
export function deriveFileLabel(missingCount: number): string {
  if (missingCount <= 0) return "Partner set covered";
  if (missingCount === 1) return "1 missing partner";
  return "DENY";
}

/**
 * Advisory-only tooltip lines for a changeset file: evidence-gap and
 * GPT-5.6-verdict annotations, when present. Purely informational — see
 * deriveFileLabel's doc comment for why the verdict must never drive the
 * tree label itself (META-117: the model annotates, it never decides).
 * A file can be evidence-unavailable without having been checked by the
 * latest verdict, or vice versa, so the two are independent.
 */
export function verdictAnnotationLines(
  verdict: ReviewerVerdict | undefined,
  evidenceUnavailable: ReadonlySet<string>,
  path: string,
): string[] {
  const lines: string[] = [];
  if (evidenceUnavailable.has(path)) {
    lines.push("Evidence unavailable for this file in the latest reviewer pass.");
  }
  if (verdict && verdict.checked.includes(path)) {
    lines.push(`GPT-5.6 reviewer (advisory, informational only): **${verdict.verdict}**`);
    for (const finding of verdict.findings) lines.push(`- ${finding}`);
  }
  return lines;
}

/**
 * Resolve a list of absolute filesystem paths (e.g. from git index/working
 * tree changes) to repo-relative changeset keys, dropping anything outside
 * the workspace root. Vscode-free: callers pass plain `{ fsPath }` shapes so
 * this can be exercised without a vscode.Uri.
 */
export function pathsFromFsPaths(rootPath: string, fsPaths: Iterable<string>): Set<string> {
  const paths = new Set<string>();
  for (const fsPath of fsPaths) {
    const rel = relativeWorkspacePath(rootPath, fsPath);
    if (rel) paths.add(rel);
  }
  return paths;
}
