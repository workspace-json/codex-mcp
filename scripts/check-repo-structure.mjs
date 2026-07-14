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
 * enumerate them. Only consults git when rootDir is actually a checkout
 * (test fixtures under a bare temp dir skip this and rely solely on the
 * always-allowed set, so tests stay deterministic).
 */
function isGitIgnored(rootDir, name) {
  if (!existsSync(join(rootDir, ".git"))) return false;
  try {
    execFileSync("git", ["check-ignore", "-q", "--", name], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
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

  for (const entry of entries) {
    const name = entry.name;
    if (ALWAYS_ALLOWED_ROOT_ENTRIES.has(name) || isGitIgnored(rootDir, name)) continue;

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
