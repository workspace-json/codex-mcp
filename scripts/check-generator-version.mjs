#!/usr/bin/env node
// The reference generator (`agents-audit`) is invoked by version-pinned command
// string, copy-pasted across README, the extension manifest, its source, its
// walkthrough media, and the installer receipt — a Second Copy by construction
// (see META-140). This
// gate does not hand-sync those strings; it asserts they stay in sync with
// each other and with what the registry actually publishes, so drift fails
// loudly instead of shipping a stale pin.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const GENERATOR_PACKAGE = "agents-audit";
const VERSION_PATTERN = /agents-audit@(\d+\.\d+\.\d+)/g;

const SURFACES = [
  "README.md",
  "extension/package.json",
  "extension/src/commands.ts",
  "scripts/install.mjs",
  "extension/assets/walkthrough/generate.md",
];

/**
 * @param {string} rootDir
 * @param {string[]} files
 * @returns {{ file: string, version: string }[]}
 */
export function collectVersionRefs(rootDir, files) {
  const refs = [];
  for (const file of files) {
    const text = readFileSync(join(rootDir, file), "utf8");
    for (const match of text.matchAll(VERSION_PATTERN)) {
      refs.push({ file, version: match[1] });
    }
  }
  return refs;
}

/**
 * Pure comparison logic — no filesystem or network — so it's unit-testable
 * without hitting the registry.
 * @param {{ file: string, version: string }[]} refs
 * @param {string | null} registryVersion null when the registry couldn't be reached
 * @returns {string[]} violation messages; empty when clean
 */
export function findVersionMismatches(refs, registryVersion) {
  if (refs.length === 0) return [];

  const violations = [];
  const distinctVersions = [...new Set(refs.map((r) => r.version))];

  if (distinctVersions.length > 1) {
    const detail = refs.map((r) => `${r.file} -> ${r.version}`).join(", ");
    violations.push(
      `${GENERATOR_PACKAGE} version disagrees across surfaces (${detail}). Pin one version in every reference.`,
    );
    return violations; // cross-surface disagreement already fails; skip the registry check
  }

  const pinned = distinctVersions[0];
  if (registryVersion && pinned !== registryVersion) {
    const surfaceList = refs.map((r) => r.file).join(", ");
    violations.push(
      `${GENERATOR_PACKAGE}@${pinned} is pinned in every surface (${surfaceList}), but the npm registry's current version is ${registryVersion}. Update every reference to ${registryVersion}.`,
    );
  }

  return violations;
}

async function fetchRegistryVersion(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`registry responded ${res.status}`);
  const data = await res.json();
  return data.version;
}

async function main() {
  const refs = collectVersionRefs(root, SURFACES);

  let registryVersion = null;
  try {
    registryVersion = await fetchRegistryVersion(GENERATOR_PACKAGE);
  } catch (error) {
    console.warn(
      `check:generator-version: could not reach the npm registry for ${GENERATOR_PACKAGE} (${error.message}); skipping the live-version check, still checking cross-surface agreement.`,
    );
  }

  const violations = findVersionMismatches(refs, registryVersion);
  if (violations.length > 0) {
    console.error(`${GENERATOR_PACKAGE} version check failed:`);
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    refs.length > 0
      ? `${GENERATOR_PACKAGE} version check passed (${refs.length} reference(s), pinned to ${refs[0].version}).`
      : `${GENERATOR_PACKAGE} version check passed (no references found).`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
