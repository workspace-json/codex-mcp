#!/usr/bin/env node
// The reference generator (`agents-audit`) is invoked by a version-pinned
// command string, copy-pasted across README, the extension manifest, its
// source, its walkthrough media, and the installer receipt — a Second Copy by
// construction (see HAC-204). This gate does not hand-sync those strings; it
// asserts they stay in sync with EACH OTHER, so a stale pin in one surface
// fails loudly instead of shipping.
//
// It deliberately does NOT judge the pin against the npm registry's latest:
// the pin is the contract, the registry is the world, and a downstream repo's
// CI must not turn red merely because an upstream release moved ahead of a
// deliberate pin. Reconciling the pin against the *installed* agents-audit
// version is the redesign tracked in HAC-204.
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
 * Pure comparison logic — no filesystem or network. Asserts every surface pins
 * the same generator version as every other surface. It does NOT judge that
 * version against the registry (see file header / HAC-204).
 * @param {{ file: string, version: string }[]} refs
 * @param {string[]} requiredSurfaces
 * @returns {string[]} violation messages; empty when clean
 */
export function findVersionMismatches(refs, requiredSurfaces = SURFACES) {
  const representedSurfaces = new Set(refs.map((ref) => ref.file));
  const missingSurfaces = requiredSurfaces.filter((file) => !representedSurfaces.has(file));
  if (missingSurfaces.length > 0)
    return [
      `${GENERATOR_PACKAGE} pin is missing from required surface(s): ${missingSurfaces.join(", ")}. ` +
        `Each declared surface must contain a version-pinned ${GENERATOR_PACKAGE}@x.y.z command.`,
    ];

  const distinctVersions = [...new Set(refs.map((r) => r.version))];
  if (distinctVersions.length <= 1) return [];

  const detail = refs.map((r) => `${r.file} -> ${r.version}`).join(", ");
  return [`${GENERATOR_PACKAGE} version disagrees across surfaces (${detail}). Pin one version in every reference.`];
}

function main() {
  const refs = collectVersionRefs(root, SURFACES);
  const violations = findVersionMismatches(refs);
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
