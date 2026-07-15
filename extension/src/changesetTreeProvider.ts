import * as vscode from "vscode";
import type { ChangesetFile } from "./changesetLogic.js";
import { COMMAND_IDS, TRUSTED_TOOLTIP_COMMANDS } from "./commandIds.js";
import type { IntelligenceView } from "./semanticModel.js";
import { type PlainNode, buildTree, omissionBadge } from "./treeModel.js";
import { coveredTooltip, decisionTooltip, partnerTooltip, reviewTooltip } from "./tooltips.js";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

export const CHANGESET_TREE_VIEW_ID = "workspacejsonCodexChangeset";

// Color carries state, and only state. Each color means exactly one thing, and
// the deterministic decision stays the strongest signal: DENY red dominates,
// omission is amber, an included/covered partner is green, the review plane is
// gold, evidence and availability stay quiet. Structure, counts, and navigation
// get no color at all — otherwise the important states stop standing out.
const SEVERITY_ERROR = new vscode.ThemeColor("problemsErrorIcon.foreground"); // deterministic DENY / BLOCK / FAILED
const SEVERITY_WARN = new vscode.ThemeColor("problemsWarningIcon.foreground"); // omitted partner
const SEVERITY_INFO = new vscode.ThemeColor("problemsInfoIcon.foreground"); // ANNOTATE
const OK = new vscode.ThemeColor("charts.green"); // included / covered / advisory PASS
const REVIEW_GOLD = new vscode.ThemeColor("charts.yellow"); // the advisory-review plane marker

function iconFor(node: PlainNode): vscode.ThemeIcon | undefined {
  switch (node.kind) {
    case "decisionFile":
      return new vscode.ThemeIcon("error", SEVERITY_ERROR);
    case "omissionCount":
      return undefined; // structural causal line — no icon, no color
    case "partner":
      return new vscode.ThemeIcon("circle-outline", SEVERITY_WARN);
    case "covered":
      return new vscode.ThemeIcon("check", OK);
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
  if (node.id === "review") return new vscode.ThemeIcon("law", REVIEW_GOLD); // the REVIEW group header
  switch (node.reviewState) {
    case "PASS":
      return new vscode.ThemeIcon("pass", OK); // green check; the PASS text stays neutral
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
        // Deliberately NOT setting item.resourceUri: it made the file-decoration
        // badge/color leak onto the row, tinting the deterministic DENY label
        // beige so it read as a warning. The semantic icon owns the row's color;
        // the open command still targets the file.
        item.command = { command: COMMAND_IDS.openFile, title: "Open file", arguments: [uri] };
      }
    }
    // Screen readers must get the state without relying on the icon/color (§3.3).
    item.accessibilityInformation = { label: node.description ? `${node.label}, ${node.description}` : node.label };
    return item;
  }

  private tooltipFor(node: PlainNode): vscode.MarkdownString | undefined {
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
        return this.view ? trustedTooltip(reviewTooltip(this.view)) : undefined;
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
 * Register the `workspace.json` Tree View (§4.2). Uses createTreeView (not
 * registerTreeDataProvider) so the omission-count badge is set and updated from
 * the single intelligence event. Product identity ("workspace.json") is owned
 * by the Activity Bar view container and the view name ("current change"), so
 * no title/description is set here — that would double the "workspace.json"
 * label against the container header.
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

  const syncBadge = () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    treeView.badge = folder ? (omissionBadge(model.getView(folder)) ?? undefined) : undefined;
  };
  syncBadge();

  context.subscriptions.push(treeView, provider, model.onDidChangeIntelligence(syncBadge));
  return treeView;
}
