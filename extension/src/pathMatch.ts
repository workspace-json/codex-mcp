import { isAbsolute, normalize, relative } from "node:path";

/**
 * Mirrors src/path-match.ts (META-102 contract) in the main repo. Ported, not
 * imported — this extension is a standalone npm package with no build-time
 * dependency on the server. This is the ONLY path matcher used anywhere in
 * this extension; keep it in sync by hand if the upstream contract changes.
 */

export function normalizeKey(p: string): string {
  let s = normalize(p).replace(/\\/g, "/");
  s = s.replace(/^\.\//, "");
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s;
}

/** True if `query` and `storedKey` denote the same file. */
export function pathsMatch(query: string, storedKey: string): boolean {
  const q = normalizeKey(query);
  const s = normalizeKey(storedKey);
  if (q === s) return true;
  // Fallback, ONLY for an absolute query resolving to a repo-relative stored key.
  // Guarded so a bare single-segment stored key can never match an arbitrary
  // absolute path — the fallback requires the stored key to be multi-segment.
  if (isAbsolute(query) && s.includes("/") && q.endsWith(`/${s}`)) return true;
  return false;
}

/** True if `key` is a safe repo-relative path: no traversal, no absolute paths. */
export function isValidRelativeKey(key: string): boolean {
  return Boolean(key) && key !== "." && key !== ".." && !key.startsWith("../") && !key.startsWith("/");
}

/** Repo-relative key for `fsPath` under `root`, or undefined if it escapes root. */
export function relativeWorkspacePath(root: string, fsPath: string): string | undefined {
  const key = normalizeKey(relative(root, fsPath));
  return isValidRelativeKey(key) ? key : undefined;
}
