import * as vscode from "vscode";
import type { FragileFileIntelligence, WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

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

/** Evidence claims only — no synthesized counts, no relative timestamps. */
function renderMarkdown(file: FragileFileIntelligence, folder: vscode.WorkspaceFolder): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = { enabledCommands: ["vscode.open"] };
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
  return md;
}

/**
 * Tier A2: rich Markdown hover replacing the plain-string tooltip. Reads
 * only through the model; renders only for files the model reports fragile.
 */
export function registerHoverProvider(model: WorkspaceIntelligenceModel, context: vscode.ExtensionContext): void {
  const provider: vscode.HoverProvider = {
    provideHover(document) {
      const status = model.getStatus(document.uri);
      if (!status || status.kind !== "fragile") return undefined;
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!folder) return undefined;
      return new vscode.Hover(renderMarkdown(status.file, folder));
    },
  };
  context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: "file" }, provider));
}
