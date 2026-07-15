import * as vscode from "vscode";
import type { FragileFileIntelligence } from "./parseSnapshot.js";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

function enabled(): boolean {
  return vscode.workspace.getConfiguration("workspacejsonCodex.decorations").get<boolean>("enabled", true);
}

/**
 * Evidence-strength glyph, the SUBORDINATE axis (§3.1): a filled dot for
 * recorded evidence, a hollow dot for a bare assertion. This is deliberately
 * NOT a danger color — evidence strength is not decision severity, so OBSERVED
 * is never mapped to warning amber.
 */
function badgeFor(tier: FragileFileIntelligence["tier"]): string {
  return tier === "OBSERVED" ? "●" : "○";
}

/** One short, claim-scoped plain-text line (§4.1): no path, no counts, no timestamps, no command links. */
export function decorationTooltip(file: FragileFileIntelligence): string {
  const claim = file.reason ?? file.evidenceClaims[0] ?? "recorded as fragile";
  return `[workspace.json] ${file.tier} · ${claim}`;
}

/**
 * Tier A1: ambient Explorer badge. A thin renderer of the model — no
 * workspace.json reads, no tier computation, no path matching of its own.
 * All updates are driven by the model's single onDidChangeIntelligence event.
 * FileDecoration.tooltip is plain text only (§4.1); the rich Markdown lives on
 * the hover and tree surfaces that actually support it.
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
        badge: badgeFor(status.file.tier),
        tooltip: decorationTooltip(status.file),
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
