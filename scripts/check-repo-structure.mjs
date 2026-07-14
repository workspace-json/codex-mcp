#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Entries every checkout has (worktree markers, VCS internals) that no policy
// file should need to enumerate.
const ALWAYS_ALLOWED_ROOT_ENTRIES = new Set([".git"]);

// Internal planning/evidence/submission docs get a specific relocation
// message instead of the generic "unexpected root file" one.
const FORBIDDEN_ROOT_FILES = new Set([
  "PLAN.md",
  "RUNBOOK.md",
  "STATUS.md",
  "BUILD_WEEK.md",
  "CLAIM_MATRIX.md",
  "MORNING-HANDOFF.md",
]);

/**
 * Gitignored entries (node_modules/, dist/, *.log, ...) are local build
 * byproducts, not repository structure — the policy shouldn't need to
 * enumerate them. One batched `git check-ignore --stdin` call for every
 * root entry at once, not one spawn per entry: with ~30 root entries the
 * per-entry version was slow enough to blow past the test runner's default
 * timeout when run inside the full `npm run check` chain. Only consults
 * git when rootDir is actually a checkout (test fixtures under a bare temp
 * dir skip this and rely solely on the always-allowed set, so tests stay
 * deterministic and fast).
 */
function computeIgnoredRootEntries(rootDir, names) {
  if (!existsSync(join(rootDir, ".git")) || names.length === 0) return new Set();
  try {
    const output = execFileSync("git", ["check-ignore", "--stdin"], {
      cwd: rootDir,
      input: names.join("\n"),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return new Set(output.split("\n").filter(Boolean));
  } catch (error) {
    // Exit code 1 means "none of the given paths are ignored" — not an
    // error condition, just an empty result. Anything git did manage to
    // print before that (mixed matches) is still valid.
    if (error && typeof error.stdout === "string") {
      return new Set(error.stdout.split("\n").filter(Boolean));
    }
    return new Set();
  }
}

/**
 * @param {string} rootDir absolute path to the repository root to check
 * @param {{ allowedRootFiles: string[], allowedRootDirectories: string[] }} policy
 * @returns {string[]} human-readable violation messages; empty when clean
 */
export function checkRepoStructure(rootDir, policy) {
  const violations = [];
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const ignored = computeIgnoredRootEntries(
    rootDir,
    entries.map((entry) => entry.name),
  );

  for (const entry of entries) {
    const name = entry.name;
    if (ALWAYS_ALLOWED_ROOT_ENTRIES.has(name) || ignored.has(name)) continue;

    if (entry.isDirectory()) {
      if (!policy.allowedRootDirectories.includes(name)) {
        violations.push(
          `Unexpected root directory: ${name}/ — add it to config/repository-structure.json#allowedRootDirectories if intentional.`,
        );
      }
      continue;
    }

    if (FORBIDDEN_ROOT_FILES.has(name)) {
      violations.push(
        `${name} must not live at repo root — move internal planning/evidence/submission docs under docs/project/, docs/submission/, or docs/evidence/.`,
      );
      continue;
    }

    if (!policy.allowedRootFiles.includes(name)) {
      violations.push(
        `Unexpected root file: ${name} — add it to config/repository-structure.json#allowedRootFiles if intentional, or relocate it under docs/.`,
      );
    }
  }

  return violations;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..");
  const policyPath = join(repoRoot, "config", "repository-structure.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));

  const violations = checkRepoStructure(repoRoot, policy);

  if (violations.length > 0) {
    console.error("Repository structure check failed:\n");
    for (const violation of violations) console.error(`  - ${violation}`);
    console.error(`\n${violations.length} violation(s). Policy: config/repository-structure.json`);
    process.exitCode = 1;
    return;
  }

  console.log("Repository structure check passed.");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
