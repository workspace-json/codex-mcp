import { COMMAND_IDS } from "./commandIds.js";
import type { ChangesetFile } from "./changesetLogic.js";
import type { IntelligenceView } from "./semanticModel.js";
import type { ReviewSummary } from "./reviewerVerdict.js";
import { baseName } from "./treeModel.js";

/**
 * vscode-free builders for the rich-Markdown tooltip bodies (§4.3, §4.5) and
 * the status-bar text (§4.5). They return plain strings so the §9 renderer
 * invariants — covered copy always carries "Verification still required", no
 * SAFE/APPROVED/ALL CLEAR strings, the advisory boundary stays visible, action
 * links only reference allowlisted commands — are testable without vscode. The
 * provider wraps each string in a MarkdownString whose `isTrusted` is scoped to
 * {@link TRUSTED_TOOLTIP_COMMANDS}.
 *
 * Every command link is argless: it acts on the current change or active
 * editor, so no target is ever injected through a tooltip link (§7).
 */

const link = (label: string, command: string): string => `[${label}](command:${command})`;
const evidenceLine = (label: string, command: string) => link(label, command);

/** Claim-scoped tier label — never a workspace- or file-level aggregate (§2.1). */
function tierBadge(tier: "ASSERTED" | "OBSERVED"): string {
  return tier === "OBSERVED" ? "`OBSERVED`" : "`ASSERTED`";
}

/** DENY decision row: why the change is denied, which partners are absent, and the next action. */
export function decisionTooltip(file: ChangesetFile): string {
  const count = file.missingPartners.length;
  const noun = count === 1 ? "partner is" : "partners are";
  const lines = [
    "$(error) **Change denied**",
    "",
    `\`${file.path}\``,
    "",
    `${count} recorded co-change ${noun} absent:`,
    "",
    ...file.missingPartners.map((p) => `- \`${p}\` — co-change claim ${tierBadge(file.file.tier)}`),
    "",
    "---",
    "",
    "**Next:** include the partners, then run verification.",
    "",
    `${evidenceLine("Inspect evidence", COMMAND_IDS.inspectEvidence)} · ${evidenceLine("Run verification", COMMAND_IDS.runVerification)}`,
  ];
  return lines.join("\n");
}

/** A single absent co-change partner. */
export function partnerTooltip(partnerPath: string, parent: ChangesetFile): string {
  return [
    "$(circle-outline) **Recorded partner absent**",
    "",
    `\`${partnerPath}\``,
    "",
    `Co-change partner of \`${baseName(parent.path)}\` · ${tierBadge(parent.file.tier)}`,
    "",
    "Select this row to open the file.",
    "",
    evidenceLine("Inspect evidence", COMMAND_IDS.inspectEvidence),
  ].join("\n");
}

/** Covered state — MUST always carry the verification requirement (§4.2, §9). */
export function coveredTooltip(): string {
  return [
    "$(checklist) **Recorded partner set covered**",
    "",
    "All recorded partners for the current assessment are present.",
    "",
    "**Verification is still required.**",
    "",
    `${evidenceLine("Run verification", COMMAND_IDS.runVerification)} · ${evidenceLine("Inspect evidence", COMMAND_IDS.inspectEvidence)}`,
  ].join("\n");
}

/** Reviewer plane tooltip: attributed, advisory, stale-aware (§5.1, §5.2, §5.4). */
export function reviewTooltip(review: ReviewSummary, deterministic: string): string {
  const lines: string[] = ["$(law) **Advisory review**", ""];

  switch (review.state) {
    case "NOT_RUN":
      lines.push("No advisory review has run for the current change.");
      break;
    case "RUNNING":
      lines.push("Advisory review in progress.");
      break;
    case "UNAVAILABLE":
      lines.push("Reviewer unavailable.", "", review.detail ?? "Receipt could not be validated.");
      break;
    case "FAILED":
      lines.push("Review failed. Deterministic enforcement is unaffected.");
      break;
    case "STALE":
      lines.push(`Review stale · ${review.detail ?? "change has moved"}.`, "", "Re-run to review the current change.");
      break;
    default: {
      // PASS or BLOCK
      lines.push(`Advisory verdict: **${review.verdict}** — advisory only; it never overrides deterministic enforcement.`);
      break;
    }
  }

  if (review.model) {
    lines.push("", "---", "");
    lines.push(`Model: \`${review.model}\``);
    if (typeof review.reviewedCount === "number") lines.push(`Scope: ${review.reviewedCount} reviewed path(s)`);
    if (review.scopeHash) lines.push(`Scope id: \`${review.scopeHash.slice(0, 12)}\``);
    if (review.gaps.length > 0) {
      lines.push("", "Gaps:");
      for (const gap of review.gaps) lines.push(`- ${gap}`);
    }
  }

  // The advisory verdict never collapses the deterministic decision (§5.4).
  lines.push("", "---", "", `Deterministic decision: **${deterministic}**`);
  if (review.verdict) lines.push(`Advisory review: **${review.verdict}**`);
  lines.push("", link("Inspect review receipt", COMMAND_IDS.inspectReceipt));
  return lines.join("\n");
}

/**
 * Status-bar text (§4.5): left side, short, native-icon prefixed, no synthesized
 * safety language. Returns `undefined` when idle so the item hides.
 */
export function statusText(view: IntelligenceView): string | undefined {
  const { source, currentChange, review } = view;
  if (source.availability === "FAILED" || source.availability === "UNAVAILABLE")
    return "$(question) workspace.json · unavailable";
  if (source.availability !== "AVAILABLE") return "$(question) workspace.json · unavailable";
  if (!currentChange.changesetKnown) return "$(question) workspace.json · unavailable";

  if (review.state === "RUNNING") return "$(loading~spin) workspace.json · reviewing";

  switch (currentChange.decision) {
    case "DENY":
      return `$(error) workspace.json · ${currentChange.missingCount} omitted`;
    case "PARTNER_SET_COVERED":
      return "$(checklist) workspace.json · verify";
    case "ANNOTATE":
      return "$(info) workspace.json · recorded fragile";
    default:
      return undefined; // IDLE — hide
  }
}

/** Rich Markdown tooltip for the status item — mirrors the current change and review planes. */
export function statusTooltip(view: IntelligenceView): string {
  const { source, currentChange, review } = view;
  const lines: string[] = ["**workspace.json**", ""];

  if (source.availability === "FAILED") lines.push("Source: workspace.json is malformed — evidence unavailable.");
  else if (source.availability !== "AVAILABLE") lines.push("Source: evidence unavailable.");
  else if (!currentChange.changesetKnown) lines.push("Current change: unavailable (Git state unknown).");
  else {
    lines.push(`Decision: **${currentChange.decision}**`);
    if (currentChange.decision === "DENY") {
      lines.push("", `${currentChange.missingCount} evidenced partner omission(s):`);
      for (const file of currentChange.files) {
        lines.push(`- \`${file.path}\` — ${file.missingPartners.length} absent`);
      }
    } else if (currentChange.decision === "PARTNER_SET_COVERED") {
      lines.push("", "Recorded partner set covered. **Verification is still required.**");
    }
  }

  lines.push("", "---", "", `Advisory review: **${review.state}**`);
  if (review.model) lines.push(`Model: \`${review.model}\``);
  return lines.join("\n");
}
