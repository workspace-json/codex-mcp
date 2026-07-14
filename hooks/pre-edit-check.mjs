#!/usr/bin/env node
/**
 * workspace.json pre-edit hook for Codex (PreToolUse on apply_patch).
 *
 * Reads the hook event JSON on stdin, extracts the file paths the patch
 * touches, assesses them against workspace.json (fragility + co-change,
 * tiers derived mechanically from evidence), and emits a decision.
 *
 * Also runnable standalone for CI / repo-native fallback:
 *   node hooks/pre-edit-check.mjs --paths src/a.ts src/b.ts
 *   git diff --name-only | node hooks/pre-edit-check.mjs --paths-stdin
 *
 * DECISION SEMANTICS: deny on evidenced-fragile file with omitted co-change
 * partners; warn on evidenced fragility or missing partners; never approves.
 *
 * ── EVIDENCE TIER: VERIFIED ON CODEX 0.144.1 (2026-07-13) ──────────────
 * The Codex hook OUTPUT CONTRACT below (permissionDecision / additionalContext
 * JSON, exit code 2 = block) was watched live on Codex 0.144.1: deny-all and
 * fixture-specific denies blocked apply_patch, while normal and partners-covered
 * edits proceeded. Keep emitDecision() below as the single adapter point.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = (p) => resolve(here, "..", "dist", p);

const { loadWorkspace, findFragile, findCoChangePartners } = await import(dist("services/workspace.js"));
const { deriveTier, decideEnforcement, aggregateAction } = await import(dist("evidence.js"));
const { isVerifyEnabled } = await import(dist("config.js"));

// ---------------------------------------------------------------------------
// Patch parsing: extract touched paths from an apply_patch envelope or a
// unified diff. Tolerant across formats; degrades to empty (no false denies
// from a parse we don't understand).
// ---------------------------------------------------------------------------

export function extractTouchedPaths(patchText) {
  const paths = new Set();
  if (typeof patchText !== "string") return [];
  const patterns = [
    /^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm, // apply_patch envelope
    /^\+\+\+ b\/(.+)$/gm, // unified diff
    /^diff --git a\/(?:.+) b\/(.+)$/gm,
  ];
  for (const re of patterns) {
    for (const m of patchText.matchAll(re)) {
      const p = m[1].trim();
      if (p && p !== "/dev/null") paths.add(p);
    }
  }
  return [...paths];
}

// ---------------------------------------------------------------------------
// Single adapter point for the Codex hook output contract (see header note).
// ---------------------------------------------------------------------------

function emitDecision(action, messages) {
  const reason = messages.join(" | ");
  if (action === "deny") {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      })}\n`,
    );
    // Belt and suspenders: documented alternate block channel.
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
  if (action === "warn" || action === "annotate") {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: reason,
        },
      })}\n`,
    );
    process.exit(0);
  }
  process.exit(0); // no recorded history — silent, never an approval message
}

function emitUnavailable(detail) {
  emitDecision("warn", [
    `Workspace intelligence unavailable: ${detail}. The edit may proceed, but no fragility or co-change determination was made. Check WORKSPACE_JSON_PATH / WORKSPACE_JSON_ROOT and validate the artifact with \`npx @workspacejson/spec validate <file>\`.`,
  ]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let paths = [];
  // VERIFIED is opt-in and CLI/CI-only. The Codex hot path (stdin event) NEVER
  // verifies — re-running git per edit is a latency machine (HAC-111 R-V3).
  let verify = false;
  const argv = process.argv.slice(2);

  if (argv[0] === "--paths") {
    verify = isVerifyEnabled(process.env, argv);
    paths = argv.slice(1).filter((p) => p !== "--verify");
  } else if (argv[0] === "--paths-stdin") {
    verify = isVerifyEnabled(process.env, argv);
    paths = (await readStdin())
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    // Hook mode: Codex sends the event JSON on stdin. Verify stays OFF here.
    const raw = await readStdin();
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      emitUnavailable("the PreToolUse event was not valid JSON");
    }
    const patch = event?.tool_input?.command ?? event?.tool_input?.patch ?? event?.tool_input?.input ?? "";
    paths = extractTouchedPaths(patch);
  }

  if (process.env.WJSON_DENY_ALL === "1") {
    emitDecision("deny", ["WJSON_DENY_ALL smoke check: hook wiring verified."]);
  }

  if (paths.length === 0) {
    emitUnavailable("no touched file paths could be extracted from the supported apply_patch or unified-diff input");
  }

  let ws;
  try {
    ws = await loadWorkspace();
  } catch (error) {
    emitUnavailable(error instanceof Error ? error.message : String(error));
  }

  const assessments = paths.map((p) => {
    const fragile = findFragile(ws, p);
    const tier = fragile
      ? deriveTier(fragile.evidence, verify ? { verify: true, cwd: dirname(ws.sourcePath) } : undefined)
      : null;
    return decideEnforcement({
      path: p,
      fragile: Boolean(fragile),
      tier,
      reason: fragile?.reason,
      evidence: fragile?.evidence ?? [],
      coChangePartners: findCoChangePartners(ws, p),
      changesetPaths: paths,
    });
  });

  const action = aggregateAction(assessments);
  const messages = assessments.filter((a) => a.action !== "none").map((a) => a.message);
  emitDecision(action, messages);
}

main().catch((error) => {
  emitUnavailable(`the hook failed unexpectedly (${error instanceof Error ? error.message : String(error)})`);
});
