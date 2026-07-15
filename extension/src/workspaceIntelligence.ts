import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import { type IntelligenceSnapshot, type FragileFileIntelligence, parseSnapshot } from "./parseSnapshot.js";
import { relativeWorkspacePath } from "./pathMatch.js";
import { subscribeChangeset, type Changeset } from "./gitChangeset.js";
import { loadLatestReceipt, summarizeReview, type ReceiptLoad } from "./reviewerVerdict.js";
import { refreshVerdict } from "./verdictRefresh.js";
import { type AvailabilityState, type IntelligenceView, type SourceState, deriveView } from "./semanticModel.js";

export type { FragileFileIntelligence } from "./parseSnapshot.js";
export type { ChangesetFile } from "./changesetLogic.js";
export type { IntelligenceView } from "./semanticModel.js";

const ARTIFACT_PATH = ".agents/workspace.json";
const VERDICT_GLOB = ".local/workspacejson/reviewer/**/verdict.json";
const RECEIPT_GLOB = ".local/workspacejson/reviewer/**/receipt.json";
const DEBOUNCE_MS = 200;

export type FileStatus =
  | { kind: "fragile"; file: FragileFileIntelligence }
  /** In generated.fileIndex but not manual.fragileFiles: no recorded risk history — not the same as "safe". */
  | { kind: "indexed" }
  /** Not present in generated.fileIndex at all: workspace.json has no opinion on this file. */
  | { kind: "unknown" };

interface SourceEntry {
  snapshot: IntelligenceSnapshot | undefined;
  availability: AvailabilityState;
  error?: string;
}

/**
 * The extension-host singleton. Exactly one reader of workspace.json (§1.5).
 * Every renderer (decoration, hover, tree, status bar) reads through this model
 * and subscribes to onDidChangeIntelligence; none reads workspace.json, parses
 * a reviewer receipt, computes tiers, or matches paths independently (§1.1).
 *
 * The model owns three independent sources — the parsed workspace snapshot
 * (with its availability), the current Git changeset, and the latest reviewer
 * receipt discovered under `.local/workspacejson/reviewer/**` — and folds them
 * into one immutable {@link IntelligenceView} (§2.5). All three funnel into the
 * single onDidChangeIntelligence event, so every surface re-renders from one
 * snapshot version in the same event cycle. The reviewer verdict is advisory
 * only: it is surfaced in its own REVIEW plane and never rewrites the
 * deterministic decision (§5.4).
 */
export class WorkspaceIntelligenceModel implements vscode.Disposable {
  private readonly sources = new Map<string, SourceEntry>();
  private readonly changesets = new Map<string, Changeset>();
  private readonly reviews = new Map<string, ReceiptLoad>();
  private readonly artifactTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly verdictTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
    void this.loadReview(folder);

    const artifactWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ARTIFACT_PATH));
    const scheduleArtifact = () => this.scheduleArtifact(folder);
    artifactWatcher.onDidCreate(scheduleArtifact);
    artifactWatcher.onDidChange(scheduleArtifact);
    artifactWatcher.onDidDelete(scheduleArtifact);
    this.watchers.set(key, artifactWatcher);
    this.disposables.push(artifactWatcher);

    // The verdict and its sibling receipt both feed the same review refresh.
    for (const glob of [VERDICT_GLOB, RECEIPT_GLOB]) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, glob));
      const scheduleVerdict = () => this.scheduleVerdict(folder);
      watcher.onDidCreate(scheduleVerdict);
      watcher.onDidChange(scheduleVerdict);
      watcher.onDidDelete(scheduleVerdict);
      this.disposables.push(watcher);
    }

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

  private scheduleArtifact(folder: vscode.WorkspaceFolder): void {
    const key = folder.uri.toString();
    const active = this.artifactTimers.get(key);
    if (active) clearTimeout(active);
    this.artifactTimers.set(
      key,
      setTimeout(() => {
        this.artifactTimers.delete(key);
        void this.reload(folder);
      }, DEBOUNCE_MS),
    );
  }

  private scheduleVerdict(folder: vscode.WorkspaceFolder): void {
    const key = folder.uri.toString();
    const active = this.verdictTimers.get(key);
    if (active) clearTimeout(active);
    this.verdictTimers.set(
      key,
      setTimeout(() => {
        this.verdictTimers.delete(key);
        void this.loadReview(folder);
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
      // Genuinely absent/unreadable: an explicit unavailable source, not empty evidence (§6.2).
      this.sources.set(key, { snapshot: undefined, availability: "UNAVAILABLE" });
      this.emitter.fire();
      return;
    }
    let snapshot: IntelligenceSnapshot | undefined;
    try {
      snapshot = parseSnapshot(JSON.parse(raw));
    } catch {
      snapshot = undefined;
    }
    if (!snapshot) {
      // Present but malformed: a FAILED source, distinct from a missing one (§6.2).
      console.debug(`[workspace.json intelligence] present but malformed, treating as failed: ${artifact.fsPath}`);
      this.sources.set(key, { snapshot: undefined, availability: "FAILED", error: "workspace.json is malformed" });
    } else {
      this.sources.set(key, { snapshot, availability: "AVAILABLE" });
    }
    this.emitter.fire();
  }

  private onChangeset(folder: vscode.WorkspaceFolder, paths: Changeset): void {
    this.changesets.set(folder.uri.toString(), paths);
    this.emitter.fire();
  }

  async loadReview(folder: vscode.WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    await refreshVerdict(
      folder.uri.fsPath,
      async (rootPath) => {
        try {
          return await loadLatestReceipt(rootPath);
        } catch (err) {
          console.debug("[workspace.json intelligence] receipt discovery failed", err);
          throw err;
        }
      },
      (load) => this.reviews.set(key, load),
      () => this.emitter.fire(),
      (): ReceiptLoad => ({ kind: "none" }),
    );
  }

  /** The single immutable view every renderer consumes. */
  getView(folder: vscode.WorkspaceFolder): IntelligenceView {
    const key = folder.uri.toString();
    const entry = this.sources.get(key);
    const changeset = this.changesets.get(key);
    const load = this.reviews.get(key) ?? { kind: "none" as const };
    const source: SourceState = {
      path: ARTIFACT_PATH,
      availability: entry?.availability ?? "UNKNOWN",
      error: entry?.error,
    };
    return deriveView({
      snapshot: entry?.snapshot,
      source,
      changeset,
      review: summarizeReview(load, changeset),
    });
  }

  getStatus(uri: vscode.Uri): FileStatus | undefined {
    if (uri.scheme !== "file") return undefined;
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return undefined;
    const entry = this.sources.get(folder.uri.toString());
    if (!entry?.snapshot) return undefined;
    const path = relativeWorkspacePath(folder.uri.fsPath, uri.fsPath);
    if (!path) return undefined;
    const fragile = entry.snapshot.fragileFiles.get(path);
    if (fragile) return { kind: "fragile", file: fragile };
    return entry.snapshot.fileIndex.has(path) ? { kind: "indexed" } : { kind: "unknown" };
  }

  dispose(): void {
    for (const timer of this.artifactTimers.values()) clearTimeout(timer);
    for (const timer of this.verdictTimers.values()) clearTimeout(timer);
    for (const disposable of this.disposables) disposable.dispose();
  }
}
