import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import { type IntelligenceSnapshot, type FragileFileIntelligence, parseSnapshot } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";

export type { FragileFileIntelligence } from "./parseSnapshot.js";

const ARTIFACT_PATH = ".agents/workspace.json";
const DEBOUNCE_MS = 200;

export type FileStatus =
  | { kind: "fragile"; file: FragileFileIntelligence }
  /** In generated.fileIndex but not manual.fragileFiles: no recorded risk history — not the same as "safe". */
  | { kind: "indexed" }
  /** Not present in generated.fileIndex at all: workspace.json has no opinion on this file. */
  | { kind: "unknown" };

/**
 * The extension-host singleton. Exactly one reader of workspace.json.
 * Every renderer (decoration, hover, ...) reads through this model and
 * subscribes to onDidChangeIntelligence; none reads workspace.json or
 * computes tiers/path matches independently (HAC-170).
 *
 * Scope note: this ships Tier A1 (Explorer decoration) + A2 (rich hover)
 * only. Current-changeset tracking and the GPT-5.6 reviewer verdict are
 * real spine responsibilities per the HAC-170 spec, but there is no write
 * path from the reviewer (HAC-136/HAC-102) into workspace.json yet — the
 * reviewer's verdict is a transient per-diff artifact
 * (.local/workspacejson/reviewer/<ts>/verdict.json), not one of the four
 * stable paths this model is scoped to read. Surfacing an always-empty
 * changeset or an always-absent verdict here would be exactly the
 * synthesized-signal anti-pattern this spec exists to prevent, so both —
 * and the Tier A3 live-changeset tree node that consumes them — are
 * deferred until HAC-136 lands and a real read path exists. This matches
 * the spec's own sequencing note: "If eligibility work is not yet safe,
 * ship A1+A2 and defer A3."
 */
export class WorkspaceIntelligenceModel implements vscode.Disposable {
  private readonly snapshots = new Map<string, IntelligenceSnapshot | undefined>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly watchers = new Map<string, vscode.FileSystemWatcher>();
  private readonly emitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [this.emitter];

  readonly onDidChangeIntelligence = this.emitter.event;

  constructor() {
    for (const folder of vscode.workspace.workspaceFolders ?? []) this.attach(folder);
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.added) this.attach(folder);
      }),
    );
  }

  private attach(folder: vscode.WorkspaceFolder): void {
    const key = folder.uri.toString();
    if (this.watchers.has(key)) return;
    void this.reload(folder);
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ARTIFACT_PATH));
    const schedule = () => this.schedule(folder);
    watcher.onDidCreate(schedule);
    watcher.onDidChange(schedule);
    watcher.onDidDelete(schedule);
    this.watchers.set(key, watcher);
    this.disposables.push(watcher);
  }

  private schedule(folder: vscode.WorkspaceFolder): void {
    const key = folder.uri.toString();
    const active = this.timers.get(key);
    if (active) clearTimeout(active);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.reload(folder);
      }, DEBOUNCE_MS),
    );
  }

  private async reload(folder: vscode.WorkspaceFolder): Promise<void> {
    const artifact = vscode.Uri.joinPath(folder.uri, ARTIFACT_PATH);
    const key = folder.uri.toString();
    let raw: string;
    try {
      raw = await fs.readFile(artifact.fsPath, "utf8");
    } catch {
      // Genuinely absent or unreadable: silent-ok, no opinion to report.
      this.snapshots.set(key, undefined);
      this.emitter.fire();
      return;
    }
    let snapshot: IntelligenceSnapshot | undefined;
    try {
      snapshot = parseSnapshot(JSON.parse(raw));
    } catch {
      snapshot = undefined;
    }
    if (!snapshot) console.debug(`[workspace.json intelligence] present but malformed, treating as unavailable: ${artifact.fsPath}`);
    this.snapshots.set(key, snapshot);
    this.emitter.fire();
  }

  getStatus(uri: vscode.Uri): FileStatus | undefined {
    if (uri.scheme !== "file") return undefined;
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return undefined;
    const snapshot = this.snapshots.get(folder.uri.toString());
    if (!snapshot) return undefined;
    const path = relativeWorkspacePath(folder.uri.fsPath, uri.fsPath);
    if (!path) return undefined;
    const fragile = snapshot.fragileFiles.get(path);
    if (fragile) return { kind: "fragile", file: fragile };
    return snapshot.fileIndex.has(path) ? { kind: "indexed" } : { kind: "unknown" };
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const disposable of this.disposables) disposable.dispose();
  }
}
