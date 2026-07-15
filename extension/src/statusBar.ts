import * as vscode from "vscode";
import { COMMAND_IDS } from "./commandIds.js";
import { TRUSTED_TOOLTIP_COMMANDS } from "./commandIds.js";
import { statusText, statusTooltip } from "./tooltips.js";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

/**
 * Tier A #7: the synchronized status-bar heartbeat (§4.5). Left-aligned, short
 * text, native icons only, no custom foreground/background colors, hidden when
 * idle. It updates in the same onDidChangeIntelligence event as the tree and
 * decorations, so all surfaces always reflect one snapshot version. Clicking it
 * focuses the current-change tree.
 */
export function registerStatusBar(model: WorkspaceIntelligenceModel, context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = COMMAND_IDS.focusCurrentChange;

  const render = () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      item.hide();
      return;
    }
    const view = model.getView(folder);
    const text = statusText(view);
    if (!text) {
      item.hide();
      return;
    }
    item.text = text;
    const tooltip = new vscode.MarkdownString(statusTooltip(view), true);
    tooltip.supportThemeIcons = true;
    tooltip.isTrusted = { enabledCommands: [...TRUSTED_TOOLTIP_COMMANDS] };
    item.tooltip = tooltip;
    item.show();
  };

  render();
  context.subscriptions.push(item, model.onDidChangeIntelligence(render));
}
