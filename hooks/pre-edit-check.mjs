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

const { loadWorkspaceOutcome, findFragile, findCoChangePartners } = await import(dist("services/workspace.js"));
const { deriveTier, decideEnforcement, aggregateAction } = await import(dist("evidence.js"));

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
  const argv = process.argv.slice(2);

  if (argv[0] === "--paths") {
    paths = argv.slice(1);
  } else if (argv[0] === "--paths-stdin") {
    paths = (await readStdin())
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    // Hook mode: Codex sends the event JSON on stdin.
    const raw = await readStdin();
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      process.exit(0); // unparseable event: stay out of the way, never fabricate
    }
    const patch = event?.tool_input?.command ?? event?.tool_input?.patch ?? event?.tool_input?.input ?? "";
    paths = extractTouchedPaths(patch);
  }

  if (process.env.WJSON_DENY_ALL === "1") {
    emitDecision("deny", ["WJSON_DENY_ALL smoke check: hook wiring verified."]);
  }

  if (paths.length === 0) process.exit(0);

  const outcome = await loadWorkspaceOutcome();
  if (outcome.status === "missing") {
    process.exit(0); // no evidence file at all: silent no-opinion, never an approval
  }
  if (outcome.status === "invalid") {
    // Evidence file IS present but corrupt/unreadable. Fail open (never block the
    // edit loop on our own parse failure) but say so explicitly — a silent allow
    // here would let a truncated/garbage workspace.json invisibly disable the gate.
    emitDecision("warn", [
      `workspace intelligence UNAVAILABLE — evidence present but unusable: ${outcome.detail}. Co-change enforcement is OFF for this edit; treat risk as UNKNOWN.`,
    ]);
  }
  const ws = outcome.workspace;

  const assessments = paths.map((p) => {
    const fragile = findFragile(ws, p);
    const tier = fragile ? deriveTier(fragile.evidence) : null;
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

main().catch(() => process.exit(0)); // hook must never crash the edit loop
