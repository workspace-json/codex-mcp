/**
 * Normalized, reader-facing model of a workspace.json file.
 *
 * IMPORTANT (provenance): the raw on-disk shape of workspace.json is defined by
 * the workspace.json standard (see @workspacejson/spec). This module reads a
 * TOLERANT superset of plausible v0.x shapes and normalizes them into the types
 * below. Field paths consumed: `manual.fragileFiles`, `manual.coChangePatterns`,
 * `generated.fileIndex`, `generated.frameworkManifest`. If the canonical schema
 * differs from what is parsed here, adjust `services/workspace.ts` only; the rest
 * of the server depends on these normalized types, not the raw file.
 */

export interface FragileFile {
  /** Repo-relative path of the fragile file. */
  path: string;
  /** Human-readable reason the file is considered fragile, if provided. */
  reason?: string;
  /** Optional numeric severity/score if the source supplies one (higher = more fragile). */
  score?: number;
  /** Evidence records backing the classification (normalized; producer tiers dropped). */
  evidence: import("./evidence.js").EvidenceRecord[];
}

export interface CoChangeGroup {
  /** Set of files that historically change together. */
  files: string[];
  /** Optional strength/confidence of the association (0..1) if provided. */
  strength?: number;
}

export interface FrameworkManifest {
  /** Detected frameworks/tools, normalized to a flat record for display. */
  [key: string]: unknown;
}

export interface NormalizedWorkspace {
  /** Absolute path to the workspace.json file that was loaded. */
  sourcePath: string;
  /** Standard/schema version string if present (e.g. "0.4"). */
  version?: string;
  fragileFiles: FragileFile[];
  coChangeGroups: CoChangeGroup[];
  /** Set of all indexed file paths, if a file index is present. */
  fileIndex: string[];
  frameworkManifest?: FrameworkManifest;
}

/** Raised when no workspace.json can be located. */
export class WorkspaceNotFoundError extends Error {
  constructor(searched: string[]) {
    super(
      `No workspace.json found. Searched: ${searched.join(", ")}. ` +
        `Set ${"WORKSPACE_JSON_PATH"} to point at the file, or run from a directory containing .agents/workspace.json.`,
    );
    this.name = "WorkspaceNotFoundError";
  }
}

/**
 * Raised when a workspace.json file IS present but cannot be trusted as
 * evidence: unparseable JSON, or a structurally-wrong root (array/primitive/null
 * rather than an object). Distinct from WorkspaceNotFoundError so callers can
 * stay silent on "no file" but surface an explicit unknown/unavailable signal on
 * "file present but corrupt" instead of silently proceeding as if unopinionated.
 */
export class WorkspaceInvalidError extends Error {
  constructor(sourcePath: string, detail: string) {
    super(`workspace.json at ${sourcePath} is present but unusable: ${detail}`);
    this.name = "WorkspaceInvalidError";
  }
}
