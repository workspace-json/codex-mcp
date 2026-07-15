import type { EvidenceTier, FragileFileIntelligence, IntelligenceSnapshot } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";

/**
 * The role a file plays in the CURRENT change, for the decision-oriented
 * Explorer decoration. Decision role dominates ("what needs my attention?");
 * evidence stays subordinate. Pure and vscode-free so it is unit-testable.
 */
export type ChangeRole =
  | { role: "denied"; missingCount: number; tier: EvidenceTier }
  | { role: "omitted"; parent: string; tier: EvidenceTier }
  | { role: "included"; parent: string }
  | { role: "fragile"; tier: EvidenceTier; claim: string };

export function changeRoleFor(
  snapshot: IntelligenceSnapshot | undefined,
  changeset: ReadonlySet<string>,
  path: string,
): ChangeRole | undefined {
  if (!snapshot) return undefined;
  const inChange = changeset.has(path);
  const fragile = snapshot.fragileFiles.get(path);

  // Denied: a fragile file, in the change, with at least one omitted partner.
  if (fragile && inChange) {
    const missing = fragile.coChangePartners.filter((p) => !changeset.has(p));
    if (missing.length > 0) return { role: "denied", missingCount: missing.length, tier: fragile.tier };
  }

  // Omitted: NOT in the change, but a recorded co-change partner of a changed fragile file.
  if (!inChange) {
    for (const changedPath of changeset) {
      const cf = snapshot.fragileFiles.get(changedPath);
      if (cf?.coChangePartners.includes(path)) return { role: "omitted", parent: changedPath, tier: cf.tier };
    }
  }

  // Included: in the change, and a recorded co-change partner of another changed fragile file.
  if (inChange) {
    for (const changedPath of changeset) {
      if (changedPath === path) continue;
      const cf = snapshot.fragileFiles.get(changedPath);
      if (cf?.coChangePartners.includes(path)) return { role: "included", parent: changedPath };
    }
  }

  // Otherwise a fragile file with no current-change role: a subordinate evidence marker.
  if (fragile)
    return { role: "fragile", tier: fragile.tier, claim: fragile.reason ?? fragile.evidenceClaims[0] ?? "recorded as fragile" };
  return undefined;
}

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
