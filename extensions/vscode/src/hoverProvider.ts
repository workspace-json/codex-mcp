import * as vscode from "vscode";
import type { FragileFileIntelligence, WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

/** Evidence claims only — no synthesized counts, no relative timestamps. */
function renderMarkdown(file: FragileFileIntelligence): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = false;
  md.appendMarkdown(`**workspace.json · ${file.tier}**\n\n`);
  md.appendMarkdown(`${file.reason ?? "Recorded as fragile."}\n`);
  if (file.evidenceClaims.length > 0) {
    md.appendMarkdown("\n**Evidence:**\n");
    for (const claim of file.evidenceClaims) md.appendMarkdown(`- ${claim}\n`);
  }
  if (file.coChangePartners.length > 0) {
    md.appendMarkdown("\n**Co-change partners:**\n");
    for (const partner of file.coChangePartners) md.appendMarkdown(`- \`${partner}\`\n`);
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
      return new vscode.Hover(renderMarkdown(status.file));
    },
  };
  context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: "file" }, provider));
}
