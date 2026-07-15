import { promises as fs } from "node:fs";
import { join } from "node:path";
import { normalizeKey } from "./pathMatch.js";

/**
 * Latest GPT-5.6 reviewer verdict.
 *
 * Schema matches the direct-API reviewer artifact:
 * { status: "COMPLETED", artifactDir, verdict: "PASS"|"BLOCK", findings: string[], evidence: string[], checked: string[], gaps: string[] }
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
  const status = r.status;
  const verdict = r.verdict;
  if (status !== "COMPLETED") return undefined;
  if (verdict !== "PASS" && verdict !== "BLOCK") return undefined;
  const artifactDir = typeof r.artifactDir === "string" ? r.artifactDir : "";
  if (!isStringArray(r.findings) || !isStringArray(r.evidence) || !isStringArray(r.checked) || !isStringArray(r.gaps)) return undefined;
  return {
    status,
    verdict,
    artifactDir,
    findings: r.findings,
    evidence: r.evidence,
    checked: normalizePaths(r.checked),
    gaps: normalizePaths(r.gaps),
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

/** Discover the newest verdict file by mtime (the artifactDir path is caller-overridable, so name-sorting is unsafe). */
export async function findLatestVerdict(rootPath: string): Promise<ReviewerVerdict | undefined> {
  const files = await findVerdictFiles(rootPath);
  if (files.length === 0) return undefined;
  let newest: { path: string; mtime: number } | undefined;
  for (const path of files) {
    try {
      const stat = await fs.stat(path);
      if (!newest || stat.mtimeMs > newest.mtime) newest = { path, mtime: stat.mtimeMs };
    } catch {
      // ignore unreadable entries
    }
  }
  if (!newest) return undefined;
  try {
    const raw = JSON.parse(await fs.readFile(newest.path, "utf8"));
    return parseVerdict(raw);
  } catch {
    return undefined;
  }
}
