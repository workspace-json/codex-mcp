import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import { type IntelligenceSnapshot, type FragileFileIntelligence, parseSnapshot } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";
import { subscribeChangeset, type Changeset } from "./gitChangeset.js";
import { findLatestVerdict, type ReviewerVerdict } from "./reviewerVerdict.js";
import { refreshVerdict } from "./verdictRefresh.js";

export type { FragileFileIntelligence } from "./parseSnapshot.js";

const ARTIFACT_PATH = ".agents/workspace.json";
const DEBOUNCE_MS = 200;

export type FileStatus =
  | { kind: "fragile"; file: FragileFileIntelligence }
  /** In generated.fileIndex but not manual.fragileFiles: no recorded risk history — not the same as "safe". */
  | { kind: "indexed" }
  /** Not present in generated.fileIndex at all: workspace.json has no opinion on this file. */
  | { kind: "unknown" };

export interface ChangesetFile {
  path: string;
  file: FragileFileIntelligence;
  /** Co-change partners that are NOT currently in the changeset. */
  missingPartners: string[];
}

export interface CurrentChange {
  /** All repo-relative paths in the current changeset (staged + working tree). */
  changeset: Set<string>;
  /** Fragile files in the changeset that have at least one missing partner. */
  files: ChangesetFile[];
  /** Total number of missing co-change partners across all files. */
  totalMissing: number;
  /** Set of repo-relative paths whose evidence is flagged unavailable in the latest verdict (gaps). */
  evidenceUnavailable: Set<string>;
  /** Latest verdict, if present. */
  verdict?: ReviewerVerdict;
}

/**
 * The extension-host singleton. Exactly one reader of workspace.json.
 * Every renderer (decoration, hover, tree) reads through this model and
 * subscribes to onDidChangeIntelligence; none reads workspace.json or
 * computes tiers/path matches independently (HAC-170).
 *
 * This spine also owns the current proposed changeset (staged + working tree
 * via the built-in vscode.git API) and the latest GPT-5.6 reviewer verdict
 * discovered under `.local/workspacejson/reviewer/** /verdict.json`.
 * Both are folded into the same onDidChangeIntelligence event so the A3
 * live-changeset tree renderer transitions live as the diff changes.
 */
export class WorkspaceIntelligenceModel implements vscode.Disposable {
  private readonly snapshots = new Map<string, IntelligenceSnapshot | undefined>();
  private readonly changesets = new Map<string, Changeset>();
  private readonly verdicts = new Map<string, ReviewerVerdict | undefined>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly watchers = new Map<string, vscode.FileSystemWatcher>();
  private readonly gitSubscriptions = new Map<string, vscode.Disposable>();
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

    void (async () => {
      const subscription = await subscribeChangeset(
        folder,
        (paths) => this.onChangeset(folder, paths),
        (err) => console.debug("[workspace.json intelligence] changeset subscription error", err),
      );
      this.gitSubscriptions.set(key, subscription);
      this.disposables.push(subscription);
    })();
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
    await this.loadVerdict(folder);
  }

  private onChangeset(folder: vscode.WorkspaceFolder, paths: Changeset): void {
    this.changesets.set(folder.uri.toString(), paths);
    this.emitter.fire();
  }

  async loadVerdict(folder: vscode.WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    await refreshVerdict(
      folder.uri.fsPath,
      async (rootPath) => {
        try {
          return await findLatestVerdict(rootPath);
        } catch (err) {
          console.debug("[workspace.json intelligence] verdict discovery failed", err);
          throw err;
        }
      },
      (verdict) => this.verdicts.set(key, verdict),
      () => this.emitter.fire(),
    );
  }

  getSnapshot(folder: vscode.WorkspaceFolder): IntelligenceSnapshot | undefined {
    return this.snapshots.get(folder.uri.toString());
  }

  getCurrentChange(folder: vscode.WorkspaceFolder): CurrentChange {
    const snapshot = this.snapshots.get(folder.uri.toString());
    const changeset = this.changesets.get(folder.uri.toString()) ?? new Set<string>();
    const verdict = this.verdicts.get(folder.uri.toString());
    const evidenceUnavailable = new Set<string>(verdict?.gaps ?? []);
    const files: ChangesetFile[] = [];
    let totalMissing = 0;

    if (snapshot) {
      for (const path of changeset) {
        const fragile = snapshot.fragileFiles.get(path);
        if (!fragile) continue;
        const missingPartners = fragile.coChangePartners.filter((p) => !changeset.has(p));
        if (missingPartners.length > 0) {
          files.push({ path, file: fragile, missingPartners });
          totalMissing += missingPartners.length;
        }
      }
      // Deterministic order: by path.
      files.sort((a, b) => a.path.localeCompare(b.path));
    }

    return { changeset, files, totalMissing, evidenceUnavailable, verdict };
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
