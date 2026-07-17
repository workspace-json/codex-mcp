import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { ENV_WORKSPACE_PATH, ENV_WORKSPACE_ROOT, WORKSPACE_JSON_CANDIDATES } from "../constants.js";
import { normalizeEvidence } from "../evidence.js";
import { normalizeKey, pathsMatch } from "../path-match.js";
import {
  type CoChangeGroup,
  type FragileFile,
  type FrameworkManifest,
  type NormalizedWorkspace,
  WorkspaceNotFoundError,
} from "../types.js";

/**
 * Root-marker resolver (clean-room; the platform's hardened resolveWorkspaceRoot
 * is stranded in an unanchored worktree per VR-649 and is not importable across
 * the clean-room boundary anyway). Walk upward from a starting directory looking
 * for a workspace.json candidate; never assume cwd is the repo root — hooks run
 * from the session working directory, which may be a nested package (same failure
 * class as the DataHub nested-dbt bridge and the worktree SWARM_DIR bug).
 */
const MAX_WALK_DEPTH = 32;

export function resolveWorkspacePath(): string {
  const explicit = process.env[ENV_WORKSPACE_PATH];
  if (explicit && explicit.trim().length > 0) {
    const p = isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
    if (!existsSync(p)) throw new WorkspaceNotFoundError([p]);
    return p;
  }

  const start = process.env[ENV_WORKSPACE_ROOT]?.trim() || process.cwd();
  const searched: string[] = [];
  let dir = resolve(start);
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth++) {
    for (const candidate of WORKSPACE_JSON_CANDIDATES) {
      const p = resolve(dir, candidate);
      searched.push(p);
      if (existsSync(p)) return p;
    }
    // A workspace artifact belongs to one repository. Never cross the nearest
    // Git boundary and accidentally consume evidence from an ancestor repo.
    if (existsSync(resolve(dir, ".git"))) break;
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  throw new WorkspaceNotFoundError(searched.slice(0, 8));
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid workspace.json: ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tolerant normalization of raw file shape. Single place that touches the raw
// artifact; everything downstream uses the normalized model. Degrades to empty,
// never fabricates. Producer-emitted tier/confidence fields are dropped.
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeFragileFiles(raw: unknown): FragileFile[] {
  if (!Array.isArray(raw)) return [];
  const out: FragileFile[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      out.push({ path: normalizeKey(entry), evidence: [] });
      continue;
    }
    const rec = asRecord(entry);
    const path = (typeof rec.path === "string" && rec.path) || (typeof rec.file === "string" && rec.file) || "";
    if (!path) continue;
    const file: FragileFile = { path: normalizeKey(path), evidence: normalizeEvidence(rec.evidence) };
    if (typeof rec.reason === "string") file.reason = rec.reason;
    else if (typeof rec.description === "string") file.reason = rec.description;
    if (typeof rec.score === "number") file.score = rec.score;
    else if (typeof rec.fragility === "number") file.score = rec.fragility;
    out.push(file);
  }
  return out;
}

function normalizeCoChange(raw: unknown): CoChangeGroup[] {
  // META-101: files is a set (string[]), joined by MEMBERSHIP, never by index.
  if (Array.isArray(raw)) {
    const out: CoChangeGroup[] = [];
    for (const entry of raw) {
      if (Array.isArray(entry)) {
        const files = entry.filter((f): f is string => typeof f === "string").map(normalizeKey);
        if (files.length >= 2) out.push({ files });
        continue;
      }
      const rec = asRecord(entry);
      const files = Array.isArray(rec.files)
        ? rec.files.filter((f): f is string => typeof f === "string").map(normalizeKey)
        : [];
      if (files.length >= 2) {
        const group: CoChangeGroup = { files };
        if (typeof rec.strength === "number") group.strength = rec.strength;
        else if (typeof rec.confidence === "number") group.strength = rec.confidence;
        out.push(group);
      }
    }
    return out;
  }
  const rec = asRecord(raw);
  const out: CoChangeGroup[] = [];
  for (const [key, value] of Object.entries(rec)) {
    const partners = Array.isArray(value)
      ? value.filter((f): f is string => typeof f === "string").map(normalizeKey)
      : [];
    if (partners.length > 0) out.push({ files: [normalizeKey(key), ...partners] });
  }
  return out;
}

function normalizeFileIndex(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((e) =>
        typeof e === "string" ? e : typeof asRecord(e).path === "string" ? (asRecord(e).path as string) : "",
      )
      .filter((p) => p.length > 0)
      .map(normalizeKey);
  }
  return Object.keys(asRecord(raw)).map(normalizeKey);
}

export function normalizeWorkspace(sourcePath: string, parsed: unknown): NormalizedWorkspace {
  const root = optionalRecord(parsed, "root");
  const manual = optionalRecord(root.manual, "manual");
  const generated = optionalRecord(root.generated, "generated");

  // Per the formal v0.4 schema, compatibility is governed by generated.specVersion;
  // top level permits only manual/generated/agents/health. Legacy variants tolerated.
  const version =
    (typeof generated.specVersion === "string" && generated.specVersion) ||
    (typeof root.version === "string" && root.version) ||
    (typeof root.schemaVersion === "string" && root.schemaVersion) ||
    undefined;

  const frameworkRaw = generated.frameworkManifest;
  const frameworkManifest =
    frameworkRaw && typeof frameworkRaw === "object" && !Array.isArray(frameworkRaw)
      ? (frameworkRaw as FrameworkManifest)
      : undefined;

  // STABLE SURFACE ONLY (per live-state audit): the four externally consumed
  // paths. health.*, sidecar files, generated.fragility, and generated.coChange
  // are deliberately NOT read here — those pipelines are in active teardown /
  // known-divergent (VR-526, VR-553, VR-432, VR-542, VR-540/541, META-103).
  return {
    sourcePath,
    version,
    fragileFiles: normalizeFragileFiles(manual.fragileFiles),
    coChangeGroups: normalizeCoChange(manual.coChangePatterns),
    fileIndex: normalizeFileIndex(generated.fileIndex),
    frameworkManifest,
  };
}

// ---------------------------------------------------------------------------
// Cached loader: mtime-gated re-read.
// ---------------------------------------------------------------------------

let cache: { path: string; mtimeMs: number; data: NormalizedWorkspace } | null = null;

export async function loadWorkspace(): Promise<NormalizedWorkspace> {
  const path = resolveWorkspacePath();
  const info = await stat(path);
  if (cache && cache.path === path && cache.mtimeMs === info.mtimeMs) {
    return cache.data;
  }
  const text = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse workspace.json at ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const data = normalizeWorkspace(path, parsed);
  cache = { path, mtimeMs: info.mtimeMs, data };
  return data;
}

export function findFragile(ws: NormalizedWorkspace, path: string): FragileFile | undefined {
  return ws.fragileFiles.find((f) => pathsMatch(path, f.path));
}

export function findCoChangePartners(ws: NormalizedWorkspace, path: string): string[] {
  const partners = new Set<string>();
  for (const group of ws.coChangeGroups) {
    if (group.files.some((f) => pathsMatch(path, f))) {
      for (const f of group.files) {
        if (!pathsMatch(path, f)) partners.add(f);
      }
    }
  }
  return [...partners];
}

export function isIndexed(ws: NormalizedWorkspace, path: string): boolean {
  return ws.fileIndex.some((k) => pathsMatch(path, k));
}

export function __resetCache(): void {
  cache = null;
}
