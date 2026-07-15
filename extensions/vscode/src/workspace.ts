import { normalize, relative } from "node:path";

export type EvidenceTier = "ASSERTED" | "OBSERVED";
export interface FragileFile { path: string; reason?: string; evidenceClaims: string[]; tier: EvidenceTier }
export interface DecorationSnapshot { fragileFiles: ReadonlyMap<string, FragileFile> }

/** Mirrors src/path-match.ts normalization for repo-relative keys. */
function normalizeRelativePath(value: string): string | undefined {
  let key = normalize(value).replace(/\\/g, "/").replace(/^\.\//, "");
  if (key.length > 1) key = key.replace(/\/+$/, "");
  if (!key || key === "." || key.startsWith("/") || key === ".." || key.startsWith("../")) return undefined;
  return key;
}

function toFragileFile(value: unknown): FragileFile | undefined {
  const record = typeof value === "string" ? { path: value } : value;
  if (!record || typeof record !== "object" || typeof (record as { path?: unknown }).path !== "string") return undefined;
  const path = normalizeRelativePath((record as { path: string }).path);
  if (!path) return undefined;
  const evidence = (record as { evidence?: unknown }).evidence;
  const evidenceClaims = Array.isArray(evidence) ? evidence.flatMap((item) => typeof item === "string" ? [item] : item && typeof item === "object" && typeof (item as { claim?: unknown }).claim === "string" ? [(item as { claim: string }).claim] : []) : [];
  return { path, reason: typeof (record as { reason?: unknown }).reason === "string" ? (record as { reason: string }).reason : undefined, evidenceClaims, tier: evidenceClaims.length ? "OBSERVED" : "ASSERTED" };
}

export function parseDecorationSnapshot(value: unknown): DecorationSnapshot | undefined {
  const fragile = value && typeof value === "object" && (value as { manual?: { fragileFiles?: unknown } }).manual?.fragileFiles;
  if (!Array.isArray(fragile)) return undefined;
  const files = new Map<string, FragileFile>();
  for (const entry of fragile) { const file = toFragileFile(entry); if (file) files.set(file.path, file); }
  return { fragileFiles: files };
}

export function relativeWorkspacePath(root: string, file: string): string | undefined { return normalizeRelativePath(relative(root, file)); }
