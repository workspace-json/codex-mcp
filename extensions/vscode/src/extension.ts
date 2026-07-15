import * as vscode from "vscode";
import { registerDecorationProvider } from "./decorationProvider.js";
import { registerHoverProvider } from "./hoverProvider.js";
import { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

export function activate(context: vscode.ExtensionContext): void {
  const model = new WorkspaceIntelligenceModel();
  context.subscriptions.push(model);
  registerDecorationProvider(model, context);
  registerHoverProvider(model, context);
}

export function deactivate(): void {}
