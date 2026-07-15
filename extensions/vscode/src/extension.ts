import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import { type DecorationSnapshot, type FragileFile, parseDecorationSnapshot, relativeWorkspacePath } from "./workspace.js";

const ARTIFACT = ".agents/workspace.json";
const DEBOUNCE_MS = 200;
const enabled = () => vscode.workspace.getConfiguration("workspacejsonCodex.decorations").get<boolean>("enabled", true);
const tooltip = (file: FragileFile) => [`[workspace.json · ${file.tier}]`, file.reason ?? "Recorded as fragile.", ...(file.evidenceClaims.length ? ["Evidence:", ...file.evidenceClaims.map((claim) => `• ${claim}`)] : [])].join("\n\n");

export function activate(context: vscode.ExtensionContext): void {
  const state = new Map<string, DecorationSnapshot | undefined>();
  const changed = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers = new Map<string, vscode.FileSystemWatcher>();

  const reload = async (folder: vscode.WorkspaceFolder) => {
    try { state.set(folder.uri.toString(), parseDecorationSnapshot(JSON.parse(await fs.readFile(vscode.Uri.joinPath(folder.uri, ARTIFACT).fsPath, "utf8")))); }
    catch { state.set(folder.uri.toString(), undefined); console.debug(`[workspace.json decorations] unavailable: ${folder.uri.fsPath}/${ARTIFACT}`); }
    changed.fire(undefined);
  };
  const schedule = (folder: vscode.WorkspaceFolder) => {
    const key = folder.uri.toString(); const active = timers.get(key); if (active) clearTimeout(active);
    timers.set(key, setTimeout(() => { timers.delete(key); void reload(folder); }, DEBOUNCE_MS));
  };
  const attach = (folder: vscode.WorkspaceFolder) => {
    const key = folder.uri.toString(); if (watchers.has(key)) return;
    void reload(folder);
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ARTIFACT));
    watcher.onDidCreate(() => schedule(folder), undefined, context.subscriptions);
    watcher.onDidChange(() => schedule(folder), undefined, context.subscriptions);
    watcher.onDidDelete(() => schedule(folder), undefined, context.subscriptions);
    watchers.set(key, watcher); context.subscriptions.push(watcher);
  };
  for (const folder of vscode.workspace.workspaceFolders ?? []) attach(folder);
  const provider: vscode.FileDecorationProvider = {
    provideFileDecoration(uri) {
      if (!enabled() || uri.scheme !== "file") return undefined;
      const folder = vscode.workspace.getWorkspaceFolder(uri); const path = folder && relativeWorkspacePath(folder.uri.fsPath, uri.fsPath);
      const file = folder && path ? state.get(folder.uri.toString())?.fragileFiles.get(path) : undefined;
      return file ? { badge: "⚠", color: new vscode.ThemeColor(file.tier === "OBSERVED" ? "charts.yellow" : "charts.blue"), tooltip: tooltip(file) } : undefined;
    }, onDidChangeFileDecorations: changed.event,
  };
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(provider), changed, vscode.workspace.onDidChangeWorkspaceFolders((event) => event.added.forEach(attach)), vscode.workspace.onDidChangeConfiguration((event) => { if (event.affectsConfiguration("workspacejsonCodex.decorations.enabled")) changed.fire(undefined); }), new vscode.Disposable(() => timers.forEach(clearTimeout)));
}
export function deactivate(): void {}
