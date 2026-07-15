import * as vscode from "vscode";
import { registerChangesetTreeProvider } from "./changesetTreeProvider.js";
import { registerDecorationProvider } from "./decorationProvider.js";
import { registerHoverProvider } from "./hoverProvider.js";
import { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

export function activate(context: vscode.ExtensionContext): void {
  vscode.commands.executeCommand("setContext", "workspacejsonCodex.changesetView.enabled", true);

  const model = new WorkspaceIntelligenceModel();
  context.subscriptions.push(model);
  registerDecorationProvider(model, context);
  registerHoverProvider(model, context);
  registerChangesetTreeProvider(model, context);

}

export function deactivate(): void {}
