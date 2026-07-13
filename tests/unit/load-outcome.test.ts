import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV_WORKSPACE_PATH } from "../../src/constants.js";
import { __resetCache, loadWorkspaceOutcome } from "../../src/services/workspace.js";

/**
 * HAC-130: the pre-edit gate must distinguish "no evidence file" (silent, no
 * opinion) from "evidence file present but unreadable / wrong-shape" (explicit
 * unknown/unavailable). loadWorkspaceOutcome is the testable decision point the
 * hook maps onto allow/warn.
 */

let dir: string;
const prev = process.env[ENV_WORKSPACE_PATH];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wsjson-outcome-"));
  __resetCache();
});

afterEach(() => {
  if (prev === undefined) delete process.env[ENV_WORKSPACE_PATH];
  else process.env[ENV_WORKSPACE_PATH] = prev;
  __resetCache();
  rmSync(dir, { recursive: true, force: true });
});

function pointAt(contents: string): void {
  const p = join(dir, "workspace.json");
  writeFileSync(p, contents, "utf8");
  process.env[ENV_WORKSPACE_PATH] = p;
}

describe("loadWorkspaceOutcome", () => {
  it("returns 'missing' when no workspace.json exists (silent no-opinion is defensible)", async () => {
    process.env[ENV_WORKSPACE_PATH] = join(dir, "does-not-exist.json");
    const outcome = await loadWorkspaceOutcome();
    expect(outcome.status).toBe("missing");
  });

  it("returns 'invalid' on malformed JSON (must NOT be a silent allow)", async () => {
    pointAt("{ this is not valid json ");
    const outcome = await loadWorkspaceOutcome();
    expect(outcome.status).toBe("invalid");
  });

  it("returns 'invalid' on a structurally-wrong root ([] instead of an object)", async () => {
    pointAt("[]");
    const outcome = await loadWorkspaceOutcome();
    expect(outcome.status).toBe("invalid");
  });

  it("returns 'invalid' on a non-object root (a bare JSON string)", async () => {
    pointAt('"nope"');
    const outcome = await loadWorkspaceOutcome();
    expect(outcome.status).toBe("invalid");
  });

  it("returns 'ok' for a valid but empty object (a real, usable empty workspace)", async () => {
    pointAt("{}");
    const outcome = await loadWorkspaceOutcome();
    expect(outcome.status).toBe("ok");
  });
});
