import * as vscode from "vscode";
import type { ChangesetFile } from "./changesetLogic.js";
import { COMMAND_IDS, TRUSTED_TOOLTIP_COMMANDS } from "./commandIds.js";
import type { IntelligenceView } from "./semanticModel.js";
import { type PlainNode, buildTree, omissionBadge } from "./treeModel.js";
import { coveredTooltip, decisionTooltip, partnerTooltip, reviewTooltip } from "./tooltips.js";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

export const CHANGESET_TREE_VIEW_ID = "workspacejsonCodexChangeset";

// Decision severity is the dominant, action-oriented axis and carries a theme
// color (§3.1 "DENY: error/red icon"). Evidence strength and availability stay
// subordinate — absence is a neutral hollow circle, never a danger color (§3.1,
// §4.2). Color is one signal among glyph + label, never the only distinction.
const SEVERITY_ERROR = new vscode.ThemeColor("problemsErrorIcon.foreground");
const SEVERITY_INFO = new vscode.ThemeColor("problemsInfoIcon.foreground");

function iconFor(node: PlainNode): vscode.ThemeIcon | undefined {
  switch (node.kind) {
    case "decisionFile":
      return new vscode.ThemeIcon("error", SEVERITY_ERROR);
    case "partner":
      return new vscode.ThemeIcon("circle-outline");
    case "covered":
      return new vscode.ThemeIcon("check");
    case "annotate":
      return new vscode.ThemeIcon("info", SEVERITY_INFO);
    case "idle":
      return new vscode.ThemeIcon("info");
    case "sourceFailed":
      return new vscode.ThemeIcon("error", SEVERITY_ERROR);
    case "sourceUnavailable":
      return new vscode.ThemeIcon("cloud-offline");
    case "changeUnknown":
      return new vscode.ThemeIcon("question");
    case "review":
      return reviewIcon(node);
    default:
      return undefined;
  }
}

function reviewIcon(node: PlainNode): vscode.ThemeIcon {
  if (node.id === "review") return new vscode.ThemeIcon("law"); // the REVIEW group header
  switch (node.reviewState) {
    case "PASS":
      return new vscode.ThemeIcon("pass");
    case "BLOCK":
    case "FAILED":
      return new vscode.ThemeIcon("error", SEVERITY_ERROR);
    case "STALE":
      return new vscode.ThemeIcon("history");
    case "RUNNING":
      return new vscode.ThemeIcon("sync");
    case "UNAVAILABLE":
      return new vscode.ThemeIcon("cloud-offline");
    case "NOT_RUN":
      return new vscode.ThemeIcon("circle-outline");
    default:
      return new vscode.ThemeIcon("question");
  }
}

function trustedTooltip(markdown: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString(markdown, true);
  md.supportThemeIcons = true;
  md.supportHtml = false;
  md.isTrusted = { enabledCommands: [...TRUSTED_TOOLTIP_COMMANDS] };
  return md;
}

export class ChangesetTreeProvider implements vscode.TreeDataProvider<PlainNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<PlainNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  /** Path → ChangesetFile for the current view, so tooltips can render claim detail. */
  private filesByPath = new Map<string, ChangesetFile>();
  private view: IntelligenceView | undefined;

  constructor(private readonly model: WorkspaceIntelligenceModel) {
    this.model.onDidChangeIntelligence(() => this.emitter.fire(undefined));
  }

  dispose(): void {
    this.emitter.dispose();
  }

  private currentView(): IntelligenceView | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return undefined;
    const view = this.model.getView(folder);
    this.view = view;
    this.filesByPath = new Map(view.currentChange.files.map((f) => [f.path, f]));
    return view;
  }

  getTreeItem(node: PlainNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      node.label,
      node.children && node.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );
    item.id = node.id;
    item.description = node.description;
    item.iconPath = iconFor(node);
    item.contextValue = node.kind;
    item.tooltip = this.tooltipFor(node);
    if (node.path) {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (folder) {
        const uri = vscode.Uri.joinPath(folder.uri, node.path);
        item.resourceUri = uri;
        item.command = { command: COMMAND_IDS.openFile, title: "Open file", arguments: [uri] };
      }
    }
    // Screen readers must get the state without relying on the icon/color (§3.3).
    item.accessibilityInformation = { label: node.description ? `${node.label}, ${node.description}` : node.label };
    return item;
  }

  private tooltipFor(node: PlainNode): vscode.MarkdownString | undefined {
    const deterministic = this.view?.currentChange.decision ?? "IDLE";
    switch (node.kind) {
      case "decisionFile": {
        const file = node.path ? this.filesByPath.get(node.path) : undefined;
        return file ? trustedTooltip(decisionTooltip(file)) : undefined;
      }
      case "partner": {
        const parentPath = node.id.split(":")[1];
        const parent = parentPath ? this.filesByPath.get(parentPath) : undefined;
        return parent && node.path ? trustedTooltip(partnerTooltip(node.path, parent)) : undefined;
      }
      case "covered":
        return trustedTooltip(coveredTooltip());
      case "review":
        if (node.id === "review") return undefined; // the group header carries no tooltip
        return this.view ? trustedTooltip(reviewTooltip(this.view.review, deterministic)) : undefined;
      default:
        return undefined;
    }
  }

  getChildren(node?: PlainNode): PlainNode[] {
    if (!node) {
      const view = this.currentView();
      return view ? buildTree(view) : [];
    }
    return node.children ?? [];
  }
}

/**
 * Register the branded `workspace.json` Tree View (§4.2). Uses createTreeView
 * (not registerTreeDataProvider) so title, description, and the omission-count
 * badge are set, and updated from the single intelligence event.
 */
export function registerChangesetTreeProvider(
  model: WorkspaceIntelligenceModel,
  context: vscode.ExtensionContext,
): vscode.TreeView<PlainNode> {
  const provider = new ChangesetTreeProvider(model);
  const treeView = vscode.window.createTreeView(CHANGESET_TREE_VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: false,
  });
  treeView.title = "workspace.json";
  treeView.description = "current change";

  const syncBadge = () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    treeView.badge = folder ? (omissionBadge(model.getView(folder)) ?? undefined) : undefined;
  };
  syncBadge();

  context.subscriptions.push(treeView, provider, model.onDidChangeIntelligence(syncBadge));
  return treeView;
}
