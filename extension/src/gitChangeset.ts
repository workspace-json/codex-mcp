import * as vscode from "vscode";
import { findDeepestRepoRoot, pathsFromFsPaths, RepoBinder } from "./changesetLogic.js";

/**
 * Minimal typings for the built-in VS Code Git extension API.
 * We only need repository state and change events.
 */
interface Change {
  readonly status: number;
  readonly uri: vscode.Uri;
}

interface RepositoryState {
  readonly HEAD: { name: string } | undefined;
  readonly indexChanges: readonly Change[];
  readonly workingTreeChanges: readonly Change[];
  /**
   * The real vscode.git API puts the change event on RepositoryState, not on
   * Repository itself. A prior version of this file declared a nonexistent
   * `Repository.onDidChangeState`, which threw `TypeError: r.onDidChangeState
   * is not a function` the moment a real repo opened (caught live in the
   * extension host log during manual HAC-170 verification) — silently
   * breaking every live changeset update after the first.
   */
  readonly onDidChange: vscode.Event<void>;
}

interface Repository {
  readonly rootUri: vscode.Uri;
  readonly state: RepositoryState;
}

interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: vscode.Event<boolean>;
  getAPI(version: 1): { state: number; repositories: readonly Repository[]; onDidOpenRepository: vscode.Event<Repository> };
}

const GIT_EXTENSION_ID = "vscode.git";

/**
 * A known changeset (possibly empty) when a Git repository backs the folder,
 * or `undefined` when Git is unavailable — so the model can honestly report an
 * unavailable current-change assessment instead of a false "no changes" (§6.2).
 */
export type Changeset = Set<string> | undefined;

async function getGitExtension(): Promise<GitExtension | undefined> {
  const extension = vscode.extensions.getExtension<GitExtension>(GIT_EXTENSION_ID);
  if (!extension) return undefined;
  if (!extension.isActive) await extension.activate();
  return extension.exports;
}

function repoChangesToPaths(rootPath: string, repo: Repository): Set<string> {
  const fsPaths = [...repo.state.indexChanges, ...repo.state.workingTreeChanges].map((change) => change.uri.fsPath);
  return pathsFromFsPaths(rootPath, fsPaths);
}

/**
 * Subscribe to changeset updates for a workspace folder.
 * The first subscription call triggers one immediate callback with the current state.
 */
export async function subscribeChangeset(
  folder: vscode.WorkspaceFolder,
  callback: (paths: Changeset) => void,
  onError: (err: Error) => void,
): Promise<vscode.Disposable> {
  const disposables: vscode.Disposable[] = [];
  const rootPath = folder.uri.fsPath;
  // Enforces that only the most specific (deepest) matching repo is ever
  // bound, disposing the previous repo's onDidChange listener the instant a
  // more specific one takes over — see RepoBinder for why that matters.
  const binder = new RepoBinder<vscode.Disposable>(rootPath);

  const emitCurrent = (repo?: Repository) => {
    try {
      // No repo => Git state is genuinely unknown, not "no changes".
      callback(repo ? repoChangesToPaths(rootPath, repo) : undefined);
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Binds to `repo` and starts tracking its changes, but only if `repo`'s root
  // is a real match for rootPath AND at least as specific as whatever is
  // currently bound (never the first-in-array match — see findDeepestRepoRoot).
  // A repo reopening at an already-bound root (e.g. a git.enabled toggle)
  // still rebinds, since RepoBinder treats equal specificity as a refresh.
  const bindIfMoreSpecific = (repo: Repository): boolean =>
    binder.tryBind(repo.rootUri.fsPath, () => {
      emitCurrent(repo);
      return repo.state.onDidChange(() => emitCurrent(repo));
    });

  try {
    const git = await getGitExtension();
    if (!git) {
      emitCurrent();
      return { dispose: () => {} };
    }

    const api = git.getAPI(1);
    const repo = findDeepestRepoRoot(
      api.repositories.map((r) => ({ rootPath: r.rootUri.fsPath, value: r })),
      rootPath,
    );
    if (repo) {
      bindIfMoreSpecific(repo);
    } else {
      emitCurrent();
    }

    const openListener = api.onDidOpenRepository((r) => {
      bindIfMoreSpecific(r);
    });
    disposables.push(openListener);

    const enablement = git.onDidChangeEnablement((enabled) => {
      if (!enabled) emitCurrent();
    });
    disposables.push(enablement);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
    emitCurrent();
  }

  return {
    dispose: () => {
      binder.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
