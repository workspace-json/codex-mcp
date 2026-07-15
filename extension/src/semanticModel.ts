import type { ChangesetFile } from "./changesetLogic.js";
import { computeChangesetFiles } from "./changesetLogic.js";
import type { IntelligenceSnapshot } from "./parseSnapshot.js";
import type { ReviewSummary } from "./reviewerVerdict.js";

/**
 * HAC-170 §2: three semantic planes kept mechanically separate. Each state
 * union attaches to a different scope and is derived by a different, total
 * function. No plane is derived from another (see the §9 invariants: changing
 * an evidence tier must not change the decision, and changing the decision
 * must not rewrite tiers). This file is deliberately vscode-import-free so it
 * can be exercised under plain `node --test` (same pattern as changesetLogic).
 */

/**
 * Assessment-scoped. Derived by deterministic policy over the current
 * changeset's recorded co-change omissions — NEVER from a model verdict and
 * NEVER from an evidence tier (§2.2, §9).
 *
 * The policy is a total function into {IDLE, ANNOTATE, PARTNER_SET_COVERED,
 * DENY}. `WARN` is a declared member of the spec's domain (§2.2) that the
 * current deterministic policy does not emit: a graduated warn/deny split
 * would have to key off evidence strength, which §9 forbids letting influence
 * the decision, so every recorded omission is treated uniformly as DENY to
 * mirror the deterministic hook (which denies on ANY missing partner). WARN is
 * kept in the union so the type is the full domain; it is reserved, not dead
 * by accident.
 */
export type DecisionState = "DENY" | "WARN" | "ANNOTATE" | "PARTNER_SET_COVERED" | "IDLE";

/** Source/operation-scoped (§2.3). Missing/malformed input lands here, never in a manufactured decision or tier. */
export type AvailabilityState = "AVAILABLE" | "STALE" | "UNKNOWN" | "UNAVAILABLE" | "FAILED";

export interface SourceState {
  /** Repo-relative artifact path, e.g. `.agents/workspace.json`. Never an absolute temp path (§4.1, §9). */
  path: string;
  availability: AvailabilityState;
  /** Concise, bounded diagnostic for FAILED; never the raw file contents (§6.3). */
  error?: string;
}

export interface CurrentChangeView {
  decision: DecisionState;
  /** All repo-relative paths in the current changeset. */
  changedPaths: string[];
  /** Fragile changed files that have at least one absent recorded partner, sorted by path. */
  files: ChangesetFile[];
  /** Total absent recorded partners across `files` — the actionable omission count. */
  missingCount: number;
  /**
   * Whether the git changeset is actually known. False when the Git API is
   * unavailable: we then have no current-change assessment (§6.2) and must not
   * pretend the change is empty/covered.
   */
  changesetKnown: boolean;
}

/**
 * The single immutable view every renderer consumes (§1.1, §2.5). No renderer
 * receives raw JSON, recomputes tiers, or re-derives a decision — they read
 * these already-separated planes.
 */
export interface IntelligenceView {
  source: SourceState;
  currentChange: CurrentChangeView;
  review: ReviewSummary;
}

/**
 * Derive the assessment-scoped decision from the current changeset alone.
 * Total, deterministic, and independent of evidence tier and reviewer verdict.
 */
export function deriveDecision(
  files: ChangesetFile[],
  fragileInChange: number,
  fragileWithPartners: number,
): DecisionState {
  if (files.length > 0) return "DENY";
  if (fragileInChange === 0) return "IDLE";
  // Fragile files are in the change but none has an absent partner.
  if (fragileWithPartners === 0) return "ANNOTATE"; // recorded fragile, nothing omissible — informational only
  return "PARTNER_SET_COVERED";
}

/**
 * Compose the immutable view from the three independent sources: the parsed
 * workspace snapshot (+ its availability), the current git changeset, and the
 * already-summarized reviewer receipt. Pure and vscode-free.
 */
export function deriveView(input: {
  snapshot: IntelligenceSnapshot | undefined;
  source: SourceState;
  changeset: ReadonlySet<string> | undefined;
  review: ReviewSummary;
}): IntelligenceView {
  const changesetKnown = input.changeset !== undefined;
  const changeset = input.changeset ?? new Set<string>();
  const { files, totalMissing } = computeChangesetFiles(input.snapshot, changeset);

  let fragileInChange = 0;
  let fragileWithPartners = 0;
  if (input.snapshot) {
    for (const path of changeset) {
      const fragile = input.snapshot.fragileFiles.get(path);
      if (!fragile) continue;
      fragileInChange += 1;
      if (fragile.coChangePartners.length > 0) fragileWithPartners += 1;
    }
  }

  // Availability degrades the decision honestly: if we could not read the
  // source or the git changeset, there is no assessment to make (§6.2).
  const canAssess = input.source.availability === "AVAILABLE" && changesetKnown;
  const decision = canAssess ? deriveDecision(files, fragileInChange, fragileWithPartners) : "IDLE";

  return {
    source: input.source,
    currentChange: {
      decision,
      changedPaths: [...changeset].sort((a, b) => a.localeCompare(b)),
      files,
      missingCount: totalMissing,
      changesetKnown,
    },
    review: input.review,
  };
}
