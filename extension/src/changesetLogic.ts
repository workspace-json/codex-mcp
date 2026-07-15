import type { FragileFileIntelligence, IntelligenceSnapshot } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";

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
