import * as vscode from "vscode";
import { pathsFromFsPaths } from "./changesetLogic.js";

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

  const emitCurrent = (repo?: Repository) => {
    try {
      // No repo => Git state is genuinely unknown, not "no changes".
      callback(repo ? repoChangesToPaths(rootPath, repo) : undefined);
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  try {
    const git = await getGitExtension();
    if (!git) {
      emitCurrent();
      return { dispose: () => {} };
    }

    const api = git.getAPI(1);
    const repo = api.repositories.find(
      (r) => r.rootUri.fsPath === rootPath || rootPath.startsWith(r.rootUri.fsPath + "/"),
    );
    if (repo) {
      emitCurrent(repo);
      disposables.push(repo.state.onDidChange(() => emitCurrent(repo)));
    } else {
      emitCurrent();
    }

    const openListener = api.onDidOpenRepository((r) => {
      if (rootPath === r.rootUri.fsPath || rootPath.startsWith(r.rootUri.fsPath + "/")) {
        emitCurrent(r);
        disposables.push(r.state.onDidChange(() => emitCurrent(r)));
      }
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
      for (const d of disposables) d.dispose();
    },
  };
}
