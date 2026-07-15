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

  context.subscriptions.push(
    vscode.commands.registerCommand("workspacejsonCodex.runVerification", async (uri?: vscode.Uri) => {
      const folder = uri ? vscode.workspace.getWorkspaceFolder(uri) : vscode.workspace.workspaceFolders?.[0];
      if (!folder) return;
      await model.loadVerdict(folder);
      // Placeholder: the real verification command will be wired to the direct-API reviewer.
      vscode.window.showInformationMessage("workspace.json: run verification command invoked.");
    }),
  );
}

export function deactivate(): void {}
