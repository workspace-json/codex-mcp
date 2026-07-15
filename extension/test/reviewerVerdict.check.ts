import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findLatestVerdict } from "../src/reviewerVerdict.js";

const VERDICT_SUBDIR = ".local/workspacejson/reviewer";

async function writeVerdict(rootPath: string, subdir: string, content: unknown, mtime: Date): Promise<void> {
  const dir = join(rootPath, VERDICT_SUBDIR, subdir);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "verdict.json");
  await writeFile(file, JSON.stringify(content));
  await utimes(file, mtime, mtime);
}

async function withTempRoot(fn: (rootPath: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "reviewer-verdict-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const VALID: Record<string, unknown> = {
  status: "COMPLETED",
  verdict: "PASS",
  artifactDir: "ignored",
  findings: [],
  evidence: [],
  checked: [],
  gaps: [],
};

test("findLatestVerdict: no reviewer directory at all yields no opinion", async () => {
  await withTempRoot(async (root) => {
    assert.equal(await findLatestVerdict(root), undefined);
  });
});

test("findLatestVerdict: picks the newest verdict by mtime, independent of directory-name sort order in either direction", async () => {
  await withTempRoot(async (root) => {
    // The mtime-newest directory is deliberately name-MIDDLE, not
    // name-first or name-last: an ascending name-sort taking the first
    // entry would wrongly pick "a-oldest", and a descending sort (or
    // "pick the last one") would wrongly pick "z-middle-mtime". Only
    // genuine mtime comparison lands on "m-newest-mtime". artifactDir is
    // caller-overridable to arbitrary labels, so name sorting in either
    // direction is not a safe stand-in for recency.
    await writeVerdict(root, "a-oldest", { ...VALID, findings: ["oldest"] }, new Date("2020-01-01"));
    await writeVerdict(root, "z-middle-mtime", { ...VALID, findings: ["middle"] }, new Date("2025-01-01"));
    await writeVerdict(root, "m-newest-mtime", { ...VALID, findings: ["fresh"] }, new Date("2030-01-01"));

    const verdict = await findLatestVerdict(root);
    assert.equal(verdict?.findings[0], "fresh");
  });
});

test("findLatestVerdict: a malformed newest verdict degrades to no opinion (no fallback to an older valid one)", async () => {
  await withTempRoot(async (root) => {
    await writeVerdict(root, "b-older-valid", VALID, new Date("2020-01-01"));
    await writeVerdict(root, "a-newest-malformed", { status: "COMPLETED" /* missing verdict field */ }, new Date("2030-01-01"));

    assert.equal(await findLatestVerdict(root), undefined);
  });
});

test("findLatestVerdict: rejects an unrecognized status or verdict value", async () => {
  await withTempRoot(async (root) => {
    await writeVerdict(root, "run", { ...VALID, status: "RUNNING" }, new Date());
    assert.equal(await findLatestVerdict(root), undefined);
  });
});

test("findLatestVerdict: normalizes checked/gaps paths and drops path-traversal entries", async () => {
  await withTempRoot(async (root) => {
    await writeVerdict(
      root,
      "run",
      { ...VALID, checked: ["src/ok.ts", "../../etc/passwd", "/abs/also-rejected.ts"], gaps: ["src//dup.ts"] },
      new Date(),
    );
    const verdict = await findLatestVerdict(root);
    assert.deepEqual(verdict?.checked, ["src/ok.ts"]);
    assert.deepEqual(verdict?.gaps, ["src/dup.ts"]);
  });
});
