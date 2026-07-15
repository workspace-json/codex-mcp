import * as vscode from "vscode";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

function enabled(): boolean {
  return vscode.workspace.getConfiguration("workspacejsonCodex.decorations").get<boolean>("enabled", true);
}

function colorFor(tier: "ASSERTED" | "OBSERVED"): vscode.ThemeColor {
  return new vscode.ThemeColor(tier === "OBSERVED" ? "charts.yellow" : "charts.blue");
}

/**
 * Tier A1: ambient Explorer badge. A thin renderer of the model — no
 * workspace.json reads, no tier computation, no path matching of its own.
 * All updates are driven by the model's single onDidChangeIntelligence
 * event; there is no manual refresh path.
 */
export function registerDecorationProvider(model: WorkspaceIntelligenceModel, context: vscode.ExtensionContext): void {
  const changed = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();

  const provider: vscode.FileDecorationProvider = {
    onDidChangeFileDecorations: changed.event,
    provideFileDecoration(uri) {
      if (!enabled() || uri.scheme !== "file") return undefined;
      const status = model.getStatus(uri);
      if (!status || status.kind !== "fragile") return undefined;
      return {
        badge: "⚠",
        color: colorFor(status.file.tier),
        tooltip: `[workspace.json · ${status.file.tier}] ${status.file.reason ?? "Recorded as fragile."}`,
      };
    },
  };

  context.subscriptions.push(
    changed,
    vscode.window.registerFileDecorationProvider(provider),
    model.onDidChangeIntelligence(() => changed.fire(undefined)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("workspacejsonCodex.decorations.enabled")) changed.fire(undefined);
    }),
  );
}
