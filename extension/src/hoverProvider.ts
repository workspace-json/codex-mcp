import * as vscode from "vscode";
import { COMMAND_IDS, TRUSTED_TOOLTIP_COMMANDS } from "./commandIds.js";
import type { FragileFileIntelligence } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";
import type { IntelligenceView } from "./semanticModel.js";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

/** Evidence-backed (has recorded evidence) vs. a bare assertion — an honest signal, not decoration. */
function tierIcon(tier: FragileFileIntelligence["tier"]): string {
  return tier === "OBSERVED" ? "$(eye)" : "$(comment)";
}

/** A clickable link that opens the co-change partner file directly. */
function partnerLink(folder: vscode.WorkspaceFolder, partnerPath: string): string {
  const uri = vscode.Uri.joinPath(folder.uri, partnerPath);
  const args = encodeURIComponent(JSON.stringify([uri.toString()]));
  return `[\`${partnerPath}\`](command:vscode.open?${args})`;
}

/**
 * Tier A2 / §4.4: rich Markdown hover. Answers why the file is marked, the
 * claim + tier that support it, what the current changeset omits or includes,
 * the next action, and whether there is a fresh advisory receipt — all at file
 * scope (no fabricated line-level precision, §4.4).
 */
function renderMarkdown(
  file: FragileFileIntelligence,
  folder: vscode.WorkspaceFolder,
  view: IntelligenceView,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = { enabledCommands: ["vscode.open", ...TRUSTED_TOOLTIP_COMMANDS] };
  md.supportHtml = false;

  md.appendMarkdown(`${tierIcon(file.tier)} **workspace.json · ${file.tier}**\n\n`);
  md.appendMarkdown(`*${file.reason ?? "Recorded as fragile."}*\n`);

  if (file.evidenceClaims.length > 0) {
    md.appendMarkdown("\n---\n\n**Evidence**\n\n");
    for (const claim of file.evidenceClaims) md.appendMarkdown(`- ${claim}\n`);
  }
  if (file.coChangePartners.length > 0) {
    md.appendMarkdown("\n**Co-change partners**\n\n");
    for (const partner of file.coChangePartners) md.appendMarkdown(`- ${partnerLink(folder, partner)}\n`);
  }

  // Current-change context: only when this exact file drives the current DENY.
  const inChange = view.currentChange.files.find((f) => f.path === file.path);
  if (inChange && inChange.missingPartners.length > 0) {
    const n = inChange.missingPartners.length;
    md.appendMarkdown(
      `\n---\n\n$(error) **Current change:** ${n} recorded ${n === 1 ? "partner is" : "partners are"} absent.\n\n`,
    );
    md.appendMarkdown(`[Run verification](command:${COMMAND_IDS.runVerification})\n`);
  }

  // Advisory receipt freshness — attributed and stale-aware, never a bare PASS.
  const review = view.review;
  if (review.state !== "NOT_RUN") {
    md.appendMarkdown(`\n---\n\nAdvisory review: **${review.state}**`);
    if (review.model) md.appendMarkdown(` · \`${review.model}\``);
    md.appendMarkdown("\n");
  }
  return md;
}

export function registerHoverProvider(model: WorkspaceIntelligenceModel, context: vscode.ExtensionContext): void {
  const provider: vscode.HoverProvider = {
    provideHover(document) {
      const status = model.getStatus(document.uri);
      if (!status || status.kind !== "fragile") return undefined;
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!folder) return undefined;
      // Guard: only render for a file that actually resolves under the folder.
      if (!relativeWorkspacePath(folder.uri.fsPath, document.uri.fsPath)) return undefined;
      return new vscode.Hover(renderMarkdown(status.file, folder, model.getView(folder)));
    },
  };
  context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: "file" }, provider));
}
