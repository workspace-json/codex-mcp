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

test("findLatestVerdict: picks the newest verdict by mtime, not by directory-name sort order", async () => {
  await withTempRoot(async (root) => {
    // Directory names are deliberately the opposite of mtime order: the
    // alphabetically-last dir is actually the oldest, and the
    // alphabetically-first dir is actually the newest. A name-sort-based
    // "pick the last one" implementation would get this backwards —
    // artifactDir is caller-overridable to arbitrary labels, so name
    // sorting is not a safe stand-in for recency.
    await writeVerdict(root, "z-alphabetically-last", { ...VALID, findings: ["stale"] }, new Date("2020-01-01"));
    await writeVerdict(root, "a-alphabetically-first", { ...VALID, findings: ["fresh"] }, new Date("2030-01-01"));

    const verdict = await findLatestVerdict(root);
    assert.equal(verdict?.findings[0], "fresh");
  });
});

test("findLatestVerdict: a malformed newest verdict degrades to no opinion (no fallback to an older valid one)", async () => {
  await withTempRoot(async (root) => {
    await writeVerdict(root, "older-valid", VALID, new Date("2020-01-01"));
    await writeVerdict(root, "newest-malformed", { status: "COMPLETED" /* missing verdict field */ }, new Date("2030-01-01"));

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
