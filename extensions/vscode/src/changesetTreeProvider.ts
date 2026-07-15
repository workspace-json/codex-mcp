import * as vscode from "vscode";
import type { WorkspaceIntelligenceModel } from "./workspaceIntelligence.js";

export const CHANGESET_TREE_VIEW_ID = "workspacejsonCodexChangeset";

export interface ChangesetTreeNode {
  id: string;
  parent?: ChangesetTreeNode;
  kind: "root" | "file" | "partner" | "covered" | "empty";
  label: string;
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  contextValue?: string;
  children?: ChangesetTreeNode[];
}

function openFileCommand(uri: vscode.Uri): vscode.Command {
  return {
    command: "vscode.open",
    title: "Open file",
    arguments: [uri],
  };
}

function openWorkspaceJsonCommand(folder: vscode.WorkspaceFolder): vscode.Command {
  return {
    command: "vscode.open",
    title: "Open workspace.json",
    arguments: [vscode.Uri.joinPath(folder.uri, ".agents/workspace.json")],
  };
}

export class ChangesetTreeProvider implements vscode.TreeDataProvider<ChangesetTreeNode> {
  private readonly emitter = new vscode.EventEmitter<ChangesetTreeNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly model: WorkspaceIntelligenceModel) {
    this.model.onDidChangeIntelligence(() => this.emitter.fire(undefined));
  }

  dispose(): void {
    this.emitter.dispose();
  }

  getTreeItem(element: ChangesetTreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.iconPath = element.iconPath;
    item.command = element.command;
    item.contextValue = element.contextValue;
    return item;
  }

  getChildren(element?: ChangesetTreeNode): ChangesetTreeNode[] {
    if (!element) return this.buildRoot();
    return element.children ?? [];
  }

  private buildRoot(): ChangesetTreeNode[] {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return [this.emptyNode("No workspace folder")];

    const current = this.model.getCurrentChange(folder);
    if (current.changeset.size === 0) return [this.emptyNode("No current changes")];

    if (current.files.length === 0) {
      return [{
        id: "covered",
        kind: "covered",
        label: "Partner set covered",
        description: "No missing partners",
        iconPath: new vscode.ThemeIcon("check"),
        contextValue: "covered",
      }];
    }

    const nodes: ChangesetTreeNode[] = [];
    for (const file of current.files) {
      const fileUri = vscode.Uri.joinPath(folder.uri, file.path);
      const missingCount = file.missingPartners.length;
      const verdict = current.verdict;
      const label =
        missingCount === 0
          ? "Partner set covered"
          : missingCount === 1
            ? "1 missing partner"
            : verdict?.verdict === "BLOCK" && verdict.checked.includes(file.path)
              ? "DENY"
              : `${missingCount} missing partners`;
      const fileNode: ChangesetTreeNode = {
        id: `file:${file.path}`,
        kind: "file",
        label,
        description: file.path,
        tooltip: new vscode.MarkdownString(`${file.file.tier} · ${file.file.reason ?? "Recorded as fragile."}`),
        iconPath: new vscode.ThemeIcon("warning"),
        command: openFileCommand(fileUri),
        children: file.missingPartners.map((partner) => {
          const partnerUri = vscode.Uri.joinPath(folder.uri, partner);
          return {
            id: `partner:${file.path}:${partner}`,
            parent: undefined,
            kind: "partner",
            label: `missing: ${partner}`,
            iconPath: new vscode.ThemeIcon("arrow-swap"),
            command: openFileCommand(partnerUri),
            contextValue: "partner",
          } as ChangesetTreeNode;
        }),
        contextValue: "fragileFile",
      };
      fileNode.children?.forEach((child) => (child.parent = fileNode));
      nodes.push(fileNode);
    }
    return nodes;
  }

  private emptyNode(message: string): ChangesetTreeNode {
    return {
      id: "empty",
      kind: "empty",
      label: message,
      iconPath: new vscode.ThemeIcon("info"),
    };
  }
}

export function registerChangesetTreeProvider(model: WorkspaceIntelligenceModel, context: vscode.ExtensionContext): void {
  const provider = new ChangesetTreeProvider(model);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(CHANGESET_TREE_VIEW_ID, provider),
    provider,
  );
}
