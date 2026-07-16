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

export interface RepoRootCandidate<T> {
  rootPath: string;
  value: T;
}

/**
 * Pick the repository root that most specifically contains `targetPath`. When
 * multiple candidate roots are prefixes of the target (a repo nested under
 * another repo's root — submodule, nested checkout, multi-root workspace),
 * the deepest (longest) root wins, independent of array order. Picking the
 * first array match instead binds the target to the WRONG repository
 * whenever the outer repo happens to come first.
 */
export function findDeepestRepoRoot<T>(candidates: readonly RepoRootCandidate<T>[], targetPath: string): T | undefined {
  let best: RepoRootCandidate<T> | undefined;
  for (const candidate of candidates) {
    const isMatch = candidate.rootPath === targetPath || targetPath.startsWith(`${candidate.rootPath}/`);
    if (isMatch && (!best || candidate.rootPath.length > best.rootPath.length)) {
      best = candidate;
    }
  }
  return best?.value;
}

export interface Disposable {
  dispose(): void;
}

/**
 * Tracks which repo root is bound to a fixed target path, enforcing that only
 * the most specific (deepest) matching root is ever bound at a time. Disposes
 * the previous binding the instant a more specific one takes over, so it is
 * structurally impossible to end up with two live bindings for the same
 * target — the earlier bug this replaces left the previous (less specific)
 * repo's listener live, so it could later fire and silently overwrite state
 * with the wrong repo's data. Pure and vscode-free: `T` only needs `dispose()`.
 */
export class RepoBinder<T extends Disposable> {
  #boundRootPath: string | undefined;
  #boundListener: T | undefined;

  constructor(private readonly targetPath: string) {}

  get boundRootPath(): string | undefined {
    return this.#boundRootPath;
  }

  /**
   * Attempt to bind `candidateRootPath`. If it is a real match for the target
   * path and at least as specific as whatever is currently bound, disposes
   * the previous listener (if any), calls `subscribe()` to obtain the new
   * one, and returns true. Otherwise leaves the current binding untouched and
   * returns false — `subscribe()` is not called in that case.
   *
   * A STRICTLY LESS specific candidate (shorter root) is rejected, so an
   * outer repo can never steal the binding from an already-bound inner one.
   * An EQUALLY specific candidate (same root path) is always accepted and
   * rebound: the Git extension can hand back a fresh Repository object for a
   * root already seen — e.g. toggling `git.enabled` off then on — whose
   * listener is a distinct subscription that must replace the old one, not
   * be rejected as "no more specific than what's already bound".
   */
  tryBind(candidateRootPath: string, subscribe: () => T): boolean {
    const isMatch = candidateRootPath === this.targetPath || this.targetPath.startsWith(`${candidateRootPath}/`);
    if (!isMatch || (this.#boundRootPath !== undefined && candidateRootPath.length < this.#boundRootPath.length)) {
      return false;
    }
    this.#boundListener?.dispose();
    this.#boundRootPath = candidateRootPath;
    this.#boundListener = subscribe();
    return true;
  }

  dispose(): void {
    this.#boundListener?.dispose();
  }
}
