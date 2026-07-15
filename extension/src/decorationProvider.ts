import * as vscode from "vscode";
import type { ChangeRole } from "./changesetLogic.js";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

function enabled(): boolean {
  return vscode.workspace.getConfiguration("workspacejsonCodex.decorations").get<boolean>("enabled", true);
}

// The Explorer answers "what needs my attention?" — decision role dominates.
// Color carries state and only state; evidence provenance moves to the tree and
// hover. FileDecoration.tooltip is plain text only (§4.1) — no absolute path
// (the extension never authors one), and the tier is grammatically bound to its
// claim so it never reads as a whole-file classification.
const DENIED = new vscode.ThemeColor("problemsErrorIcon.foreground");
const OMITTED = new vscode.ThemeColor("problemsWarningIcon.foreground");
const INCLUDED = new vscode.ThemeColor("charts.green");

export function decorationFor(role: ChangeRole): vscode.FileDecoration {
  switch (role.role) {
    case "denied": {
      const n = role.missingCount;
      return {
        badge: "!",
        color: DENIED,
        tooltip: `DENY · ${n} evidenced ${n === 1 ? "partner" : "partners"} omitted from the current change`,
      };
    }
    case "omitted":
      return { badge: "○", color: OMITTED, tooltip: "Evidenced partner omitted from the current change" };
    case "included":
      return { badge: "✓", color: INCLUDED, tooltip: "Recorded partner included in the current change" };
    case "fragile":
      return {
        badge: role.tier === "OBSERVED" ? "●" : "○",
        tooltip: `${role.tier === "OBSERVED" ? "Observed" : "Asserted"} evidence: ${role.claim}`,
      };
  }
}

/**
 * Tier A1: ambient Explorer decoration. A thin renderer of the model — no
 * workspace.json reads, no tier computation, no path matching of its own. All
 * updates are driven by the model's single onDidChangeIntelligence event.
 */
export function registerDecorationProvider(model: WorkspaceIntelligenceModel, context: vscode.ExtensionContext): void {
  const changed = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();

  const provider: vscode.FileDecorationProvider = {
    onDidChangeFileDecorations: changed.event,
    provideFileDecoration(uri) {
      if (!enabled() || uri.scheme !== "file") return undefined;
      const role = model.getChangeRole(uri);
      return role ? decorationFor(role) : undefined;
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
