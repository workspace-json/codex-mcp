import * as vscode from "vscode";
import { registerChangesetTreeProvider } from "./changesetTreeProvider.js";
import { registerCommands } from "./commands.js";
import { registerDecorationProvider } from "./decorationProvider.js";
import { registerHoverProvider } from "./hoverProvider.js";
import { registerStatusBar } from "./statusBar.js";
import { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

export function activate(context: vscode.ExtensionContext): void {
  vscode.commands.executeCommand("setContext", "workspacejsonCodex.changesetView.enabled", true);

  // One model; every surface below is a thin renderer of its single event (§1.1).
  const model = new WorkspaceIntelligenceModel();
  context.subscriptions.push(model);

  registerCommands(model, context);
  registerDecorationProvider(model, context);
  registerHoverProvider(model, context);
  registerChangesetTreeProvider(model, context);
  registerStatusBar(model, context);
}

export function deactivate(): void {}
