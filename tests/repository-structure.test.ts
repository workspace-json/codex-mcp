import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkRepoStructure } from "../scripts/check-repo-structure.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const BASE_POLICY = {
  allowedRootFiles: ["README.md", "package.json"],
  allowedRootDirectories: ["src", "docs"],
};

type FixtureEntry = { type: "file" | "dir"; name: string };

const tempDirs: string[] = [];

function makeTempRoot(entries: FixtureEntry[]): string {
  const dir = mkdtempSync(join(tmpdir(), "repo-structure-test-"));
  tempDirs.push(dir);
  for (const entry of entries) {
    if (entry.type === "dir") {
      mkdirSync(join(dir, entry.name));
    } else {
      writeFileSync(join(dir, entry.name), "");
    }
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("checkRepoStructure", () => {
  it("passes a root that only contains allowed entries", () => {
    const dir = makeTempRoot([
      { type: "file", name: "README.md" },
      { type: "file", name: "package.json" },
      { type: "dir", name: "src" },
      { type: "dir", name: "docs" },
      { type: "dir", name: ".git" },
    ]);
    expect(checkRepoStructure(dir, BASE_POLICY)).toEqual([]);
  });

  it("flags a known forbidden planning file with a relocation-specific message", () => {
    const dir = makeTempRoot([
      { type: "file", name: "README.md" },
      { type: "file", name: "PLAN.md" },
    ]);
    const violations = checkRepoStructure(dir, BASE_POLICY);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/PLAN\.md must not live at repo root/);
  });

  it("flags an unrecognized root file generically", () => {
    const dir = makeTempRoot([{ type: "file", name: "random.txt" }]);
    const violations = checkRepoStructure(dir, BASE_POLICY);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/Unexpected root file: random\.txt/);
  });

  it("flags an unrecognized root directory", () => {
    const dir = makeTempRoot([{ type: "dir", name: "scratch" }]);
    const violations = checkRepoStructure(dir, BASE_POLICY);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/Unexpected root directory: scratch\//);
  });

  it("does not require an explicit .git allow entry in the policy", () => {
    const dir = makeTempRoot([{ type: "dir", name: ".git" }]);
    expect(checkRepoStructure(dir, BASE_POLICY)).toEqual([]);
  });

  it("passes the actual repository root against its real policy", () => {
    const policy = JSON.parse(readFileSync(join(repoRoot, "config", "repository-structure.json"), "utf8"));
    expect(checkRepoStructure(repoRoot, policy)).toEqual([]);
  });
});
