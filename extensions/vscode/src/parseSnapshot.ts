import { isValidRelativeKey, normalizeKey, pathsMatch } from "./pathMatch.js";

/**
 * Tolerant normalizer for the raw workspace.json shape into the model this
 * extension renders from. Reads only the four stable paths per META-102 /
 * HAC-170: manual.fragileFiles, manual.coChangePatterns, generated.fileIndex,
 * generated.frameworkManifest. Mirrors the degrade-to-empty-on-wrong-shape
 * philosophy of src/services/workspace.ts (a field present with the wrong
 * type degrades to empty, it does not fail the whole read) — EXCEPT the
 * top-level shape and the manual/generated containers themselves, which must
 * be object-shaped or the whole snapshot is unavailable. This catches the
 * exact HAC-130 F1 regression (`workspace.json = '[]'` silently reading as
 * empty) at this layer too.
 *
 * No command replay happens here (this is a passive viewer), so a file can
 * only ever be ASSERTED (no evidence) or OBSERVED (has evidence) — never
 * VERIFIED, which requires re-running a recorded command.
 */

export type EvidenceTier = "ASSERTED" | "OBSERVED";

export interface FragileFileIntelligence {
  path: string;
  tier: EvidenceTier;
  reason?: string;
  evidenceClaims: string[];
  coChangePartners: string[];
}

export interface CoChangeGroup {
  files: string[];
  strength?: number;
}

export interface IntelligenceSnapshot {
  fragileFiles: ReadonlyMap<string, FragileFileIntelligence>;
  fileIndex: ReadonlySet<string>;
  coChangeGroups: readonly CoChangeGroup[];
  frameworkManifest?: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return {};
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function normalizeEvidence(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const claims: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      claims.push(item.trim());
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const claim = (item as { claim?: unknown }).claim;
      if (typeof claim === "string" && claim.trim()) claims.push(claim.trim());
    }
  }
  return claims;
}

function toFragileFile(raw: unknown): { path: string; reason?: string; evidenceClaims: string[] } | undefined {
  const record = typeof raw === "string" ? { path: raw } : raw;
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  const rawPath = (record as { path?: unknown }).path;
  if (typeof rawPath !== "string") return undefined;
  const path = normalizeKey(rawPath);
  if (!isValidRelativeKey(path)) return undefined;
  const reason = (record as { reason?: unknown }).reason;
  // Producer-supplied tier/confidence/score fields are deliberately dropped:
  // tiers are derived here, mechanically, never trusted from the artifact.
  return { path, evidenceClaims: normalizeEvidence((record as { evidence?: unknown }).evidence), reason: typeof reason === "string" ? reason : undefined };
}

function toCoChangeGroup(raw: unknown): CoChangeGroup | undefined {
  let rawFiles: unknown;
  let rawStrength: unknown;
  if (Array.isArray(raw)) {
    rawFiles = raw;
  } else if (raw && typeof raw === "object") {
    rawFiles = (raw as { files?: unknown }).files;
    rawStrength = (raw as { strength?: unknown }).strength;
  } else {
    return undefined;
  }
  if (!Array.isArray(rawFiles)) return undefined;
  const files = rawFiles
    .filter((f): f is string => typeof f === "string")
    .map(normalizeKey)
    .filter(isValidRelativeKey);
  if (files.length < 2) return undefined;
  const strength = typeof rawStrength === "number" ? rawStrength : undefined;
  return strength === undefined ? { files } : { files, strength };
}

export function parseSnapshot(raw: unknown): IntelligenceSnapshot | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const manual = asObject((raw as { manual?: unknown }).manual);
  const generated = asObject((raw as { generated?: unknown }).generated);
  if (!manual || !generated) return undefined;

  const rawPatterns = manual.coChangePatterns;
  let coChangeGroups: CoChangeGroup[];
  if (Array.isArray(rawPatterns)) {
    coChangeGroups = rawPatterns.map(toCoChangeGroup).filter((g): g is CoChangeGroup => Boolean(g));
  } else if (rawPatterns && typeof rawPatterns === "object") {
    coChangeGroups = Object.entries(rawPatterns as Record<string, unknown>)
      .map(([path, partners]) => (Array.isArray(partners) ? toCoChangeGroup([path, ...partners]) : undefined))
      .filter((g): g is CoChangeGroup => Boolean(g));
  } else {
    coChangeGroups = [];
  }

  const partnersFor = (path: string): string[] => {
    const partners = new Set<string>();
    for (const group of coChangeGroups) {
      if (group.files.some((f) => pathsMatch(f, path))) {
        for (const f of group.files) if (!pathsMatch(f, path)) partners.add(f);
      }
    }
    return [...partners];
  };

  const fragileFiles = new Map<string, FragileFileIntelligence>();
  const fragileRaw = Array.isArray(manual.fragileFiles) ? manual.fragileFiles : [];
  for (const entry of fragileRaw) {
    const parsed = toFragileFile(entry);
    if (!parsed) continue;
    fragileFiles.set(parsed.path, {
      path: parsed.path,
      tier: parsed.evidenceClaims.length > 0 ? "OBSERVED" : "ASSERTED",
      reason: parsed.reason,
      evidenceClaims: parsed.evidenceClaims,
      coChangePartners: partnersFor(parsed.path),
    });
  }

  const fileIndexRaw = Array.isArray(generated.fileIndex) ? generated.fileIndex : [];
  const fileIndex = new Set(
    fileIndexRaw.filter((f): f is string => typeof f === "string").map(normalizeKey).filter(isValidRelativeKey),
  );

  const frameworkManifest =
    generated.frameworkManifest && typeof generated.frameworkManifest === "object" && !Array.isArray(generated.frameworkManifest)
      ? (generated.frameworkManifest as Record<string, unknown>)
      : undefined;

  return { fragileFiles, fileIndex, coChangeGroups, frameworkManifest };
}
