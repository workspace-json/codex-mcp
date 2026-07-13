import { isAbsolute, normalize } from "node:path";

/**
 * THE path matcher. One implementation, imported by both the workspace service
 * and the evidence/enforcement layer, so there is exactly one definition of
 * "these two paths are the same file." A second matcher is how a deny silently
 * became a warn (audit Critical #1): the enforcement layer had drifted to a
 * symmetric fuzzy suffix match while the read layer was tightened. Never again —
 * both call these.
 *
 * Keys are pinned to META-102: repo-root-relative POSIX, forward slashes, no
 * leading "./", no trailing slash, no drive letters.
 */

export function normalizeKey(p: string): string {
  let s = normalize(p).replace(/\\/g, "/");
  s = s.replace(/^\.\//, ""); // drop leading ./
  if (s.length > 1) s = s.replace(/\/+$/, ""); // drop trailing slash(es)
  return s;
}

/** True if `query` and `storedKey` denote the same file. */
export function pathsMatch(query: string, storedKey: string): boolean {
  const q = normalizeKey(query);
  const s = normalizeKey(storedKey);
  if (q === s) return true;
  // Fallback, ONLY for an absolute query resolving to a repo-relative stored key
  // (a client may pass /abs/repo/src/x.ts for stored src/x.ts). Guarded so a bare
  // single-segment stored key (e.g. "client.ts") can never match an arbitrary
  // absolute path — the fallback requires the stored key to be multi-segment
  // (audit #13). No other fuzzy matching exists.
  if (isAbsolute(query) && s.includes("/") && q.endsWith(`/${s}`)) return true;
  return false;
}
