import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  findCoChangePartners,
  findFragile,
  isIndexed,
  normalizeWorkspace,
  resolveWorkspacePath,
} from "../../src/services/workspace.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../../fixture/.agents/workspace.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const sourcePath = resolve(here, "../../fixture/.agents/workspace.json");
const created: string[] = [];

afterEach(() => {
  process.env.WORKSPACE_JSON_ROOT = undefined;
  process.env.WORKSPACE_JSON_PATH = undefined;
  for (const path of created.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("resolveWorkspacePath", () => {
  it("does not consume an ancestor artifact across the nearest Git boundary", () => {
    const outer = mkdtempSync(resolve(tmpdir(), "wjson-boundary-"));
    created.push(outer);
    mkdirSync(resolve(outer, ".agents"));
    writeFileSync(resolve(outer, ".agents/workspace.json"), "{}\n");
    const nestedRepo = resolve(outer, "nested");
    mkdirSync(resolve(nestedRepo, ".git"), { recursive: true });
    mkdirSync(resolve(nestedRepo, "packages/deep"), { recursive: true });
    process.env.WORKSPACE_JSON_ROOT = resolve(nestedRepo, "packages/deep");
    expect(() => resolveWorkspacePath()).toThrow("No workspace.json found");
  });
});

describe("normalizeWorkspace", () => {
  it.each([null, [], "invalid"])("rejects a structurally invalid root: %j", (raw) => {
    expect(() => normalizeWorkspace(sourcePath, raw)).toThrow("root must be an object");
  });

  it.each([{ manual: [] }, { generated: "invalid" }])("rejects malformed consumed sections: %j", (raw) => {
    expect(() => normalizeWorkspace(sourcePath, raw)).toThrow("must be an object");
  });

  it("normalizes the fixture workspace with generated version and framework manifest", () => {
    const ws = normalizeWorkspace(sourcePath, fixture);
    expect(ws.sourcePath).toBe(sourcePath);
    expect(ws.version).toBe("0.4");
    expect(ws.frameworkManifest).toEqual({
      runtime: "node",
      framework: "next",
      testRunner: "vitest",
    });
  });

  it("normalizes fragile files and preserves score/reason", () => {
    const ws = normalizeWorkspace(sourcePath, fixture);
    const client = ws.fragileFiles.find((f) => f.path === "src/db/client.ts");
    expect(client).toBeDefined();
    expect(client?.reason).toBe("connection pool exhaustion under load; reverted 3x");
    expect(client?.score).toBe(9);
    expect(client?.evidence).toEqual([{ claim: "revert a1b2c3" }, { claim: "incident 2026-02-14" }]);
  });

  it("normalizes string-only fragile entries", () => {
    const ws = normalizeWorkspace(sourcePath, fixture);
    const session = ws.fragileFiles.find((f) => f.path === "src/auth/session.ts");
    expect(session).toBeDefined();
    expect(session?.evidence).toEqual([]);
  });

  it("normalizes co-change groups and preserves strength", () => {
    const ws = normalizeWorkspace(sourcePath, fixture);
    const clientGroup = ws.coChangeGroups.find((g) => g.files.includes("src/db/client.ts"));
    expect(clientGroup).toBeDefined();
    expect(clientGroup?.strength).toBe(0.86);
  });

  it("normalizes the file index", () => {
    const ws = normalizeWorkspace(sourcePath, fixture);
    expect(ws.fileIndex).toContain("src/db/client.ts");
    expect(ws.fileIndex).toContain("src/routes/checkout.ts");
  });

  it("tolerates legacy and alternative shapes", () => {
    const raw = {
      version: "0.3",
      manual: {
        fragileFiles: [
          "src/legacy.ts",
          { file: "src/alt.ts", description: "alt reason", fragility: 5, evidence: ["legacy"] },
        ],
        coChangePatterns: [["src/legacy.ts", "src/alt.ts"], { files: ["src/one.ts", "src/two.ts"], confidence: 0.7 }],
      },
      generated: {
        fileIndex: {
          "src/legacy.ts": 1,
          "src/alt.ts": 1,
        },
        frameworkManifest: { runtime: "node" },
      },
    };
    const ws = normalizeWorkspace("/tmp/workspace.json", raw);
    expect(ws.version).toBe("0.3");

    const legacy = ws.fragileFiles.find((f) => f.path === "src/legacy.ts");
    expect(legacy).toBeDefined();
    const alt = ws.fragileFiles.find((f) => f.path === "src/alt.ts");
    expect(alt?.reason).toBe("alt reason");
    expect(alt?.score).toBe(5);

    const arrGroup = ws.coChangeGroups.find((g) => g.files.includes("src/legacy.ts"));
    expect(arrGroup?.files).toEqual(["src/legacy.ts", "src/alt.ts"]);

    expect(ws.fileIndex).toContain("src/legacy.ts");
    expect(ws.frameworkManifest).toEqual({ runtime: "node" });
  });

  it("tolerates an adjacency map for co-change patterns", () => {
    const raw = {
      manual: {
        coChangePatterns: {
          "src/key.ts": ["src/val.ts"],
        },
      },
      generated: {},
    };
    const ws = normalizeWorkspace("/tmp/workspace.json", raw);
    const mapGroup = ws.coChangeGroups.find((g) => g.files.includes("src/key.ts"));
    expect(mapGroup?.files).toEqual(["src/key.ts", "src/val.ts"]);
  });
});

describe("findFragile", () => {
  const ws = normalizeWorkspace(sourcePath, fixture);

  it("finds fragile files by exact repo-relative path", () => {
    expect(findFragile(ws, "src/db/client.ts")).toBeDefined();
    expect(findFragile(ws, "src/routes/checkout.ts")).toBeDefined();
  });

  it("normalizes ./ and absolute paths before matching", () => {
    expect(findFragile(ws, "./src/db/client.ts")).toBeDefined();
    expect(findFragile(ws, "/abs/repo/src/db/client.ts")).toBeDefined();
  });

  it("does not do partial matching", () => {
    expect(findFragile(ws, "db/client.ts")).toBeUndefined();
    expect(findFragile(ws, "client.ts")).toBeUndefined();
  });
});

describe("findCoChangePartners", () => {
  const ws = normalizeWorkspace(sourcePath, fixture);

  it("returns partners for a file in a co-change group", () => {
    expect(findCoChangePartners(ws, "src/db/client.ts")).toContain("src/db/schema.ts");
    expect(findCoChangePartners(ws, "src/routes/checkout.ts")).toContain("src/auth/session.ts");
    expect(findCoChangePartners(ws, "src/routes/checkout.ts")).toContain("src/lib/format.ts");
  });

  it("does not include the queried file itself", () => {
    expect(findCoChangePartners(ws, "src/routes/checkout.ts")).not.toContain("src/routes/checkout.ts");
  });

  it("returns an empty array for files with no recorded partners", () => {
    expect(findCoChangePartners(ws, "src/lib/does-not-exist.ts")).toEqual([]);
  });
});

describe("isIndexed", () => {
  const ws = normalizeWorkspace(sourcePath, fixture);

  it("returns true for indexed files and false for unknown files", () => {
    expect(isIndexed(ws, "src/db/client.ts")).toBe(true);
    expect(isIndexed(ws, "src/lib/does-not-exist.ts")).toBe(false);
  });
});
