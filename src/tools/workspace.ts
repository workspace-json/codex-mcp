import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT } from "../constants.js";
import { aggregateAction, decideEnforcement, deriveTier } from "../evidence.js";
import { findCoChangePartners, findFragile, isIndexed, loadWorkspace } from "../services/workspace.js";
import { WorkspaceNotFoundError } from "../types.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Wrap a handler so workspace-not-found and parse errors return actionable text, not crashes. */
async function guarded(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof WorkspaceNotFoundError) {
      return {
        content: [{ type: "text", text: err.message }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Error reading workspace intelligence: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return `${text.slice(0, CHARACTER_LIMIT)}\n\n[truncated: response exceeded ${CHARACTER_LIMIT} characters. Narrow your query.]`;
}

// Longest text kept when a bulky string field is elided; strings shorter than
// STRING_MIN_TRUNCATE are left alone (not worth the marker overhead).
const STRING_KEEP = 60;
const STRING_MIN_TRUNCATE = STRING_KEEP + 20;

type Reducible =
  | { kind: "array"; depth: number; node: unknown[] }
  | { kind: "string"; parent: Record<string, unknown> | unknown[]; key: string | number; value: string };

function collectReducibles(
  node: unknown,
  depth: number,
  parent: unknown,
  key: string | number | null,
  out: Reducible[],
): void {
  if (Array.isArray(node)) {
    if (node.length > 0) out.push({ kind: "array", depth, node });
    node.forEach((child, i) => collectReducibles(child, depth + 1, node, i, out));
  } else if (node && typeof node === "object") {
    for (const k of Object.keys(node as Record<string, unknown>)) {
      collectReducibles((node as Record<string, unknown>)[k], depth + 1, node, k, out);
    }
  } else if (typeof node === "string" && node.length >= STRING_MIN_TRUNCATE && parent !== null && key !== null) {
    out.push({ kind: "string", parent: parent as Record<string, unknown> | unknown[], key, value: node });
  }
}

function serializedWeight(node: unknown): number {
  return JSON.stringify(node)?.length ?? 0;
}

/**
 * Guarantee JSON.stringify(result) <= CHARACTER_LIMIT on the STRUCTURED channel —
 * MCP clients consume structuredContent programmatically, so bounding only
 * content[].text leaves it unbounded. Reduces in information-preserving order:
 * (1) drop tail records from the largest top-level list, (2) truncate the longest
 * text field, (3) trim the largest nested list, then as a last resort (4) drop a
 * lone top-level record. Scalar signals (path, fragile, tier, action, workspaceVersion)
 * are never removed, so a bounded payload still carries its verdict. `truncated`
 * is set ONLY when data was actually removed, and the loop runs until the flagged
 * result truly fits — it never claims a boundedness it does not have. A payload
 * that already fits is returned untouched, with no flag.
 */
export function boundStructured(output: Record<string, unknown>): Record<string, unknown> {
  if (JSON.stringify(output).length <= CHARACTER_LIMIT) return output;

  const result = JSON.parse(JSON.stringify(output)) as Record<string, unknown>;

  // Keep `count` honest as we trim: find the top-level array whose length is count.
  let countedKey: string | null = null;
  if (typeof result.count === "number") {
    for (const [k, v] of Object.entries(result)) {
      if (Array.isArray(v) && v.length === result.count) {
        countedKey = k;
        break;
      }
    }
  }

  let droppedRecords = 0;
  let elidedChars = 0;
  const withFlags = (): Record<string, unknown> => {
    const flagged: Record<string, unknown> = {
      ...result,
      truncated: true,
      omitted: droppedRecords,
      note: `structured payload reduced to fit the ${CHARACTER_LIMIT}-char cap (${droppedRecords} record(s) dropped, ${elidedChars} char(s) of text elided). Narrow your query.`,
    };
    if (countedKey && Array.isArray(result[countedKey])) flagged.count = (result[countedKey] as unknown[]).length;
    return flagged;
  };

  let guard = 0;
  while (JSON.stringify(withFlags()).length > CHARACTER_LIMIT && guard++ < 200_000) {
    const reducibles: Reducible[] = [];
    collectReducibles(result, 0, null, null, reducibles);
    const arrays = reducibles.filter((r): r is Extract<Reducible, { kind: "array" }> => r.kind === "array");
    const strings = reducibles.filter((r): r is Extract<Reducible, { kind: "string" }> => r.kind === "string");

    const topMulti = arrays.filter((r) => r.depth === 1 && r.node.length >= 2);
    const nested = arrays.filter((r) => r.depth >= 2 && r.node.length >= 1);
    const topLone = arrays.filter((r) => r.depth === 1 && r.node.length === 1);

    const heaviest = <T extends { node: unknown[] }>(xs: T[]): T =>
      xs.sort((a, b) => serializedWeight(b.node) - serializedWeight(a.node))[0];

    if (topMulti.length > 0) {
      heaviest(topMulti).node.pop();
      droppedRecords++;
    } else if (strings.length > 0) {
      const s = strings.sort((a, b) => b.value.length - a.value.length)[0];
      (s.parent as Record<string, unknown>)[s.key as string] =
        `${s.value.slice(0, STRING_KEEP)}…[+${s.value.length - STRING_KEEP} chars]`;
      elidedChars += s.value.length - STRING_KEEP;
    } else if (nested.length > 0) {
      heaviest(nested).node.pop();
      droppedRecords++;
    } else if (topLone.length > 0) {
      heaviest(topLone).node.pop();
      droppedRecords++;
    } else {
      break; // only scalars left; already minimal
    }
  }

  return withFlags();
}

const SEVERITY_RANK: Record<string, number> = { deny: 3, warn: 2, annotate: 1, none: 0 };

/**
 * Order assessments by enforcement severity (deny first) so that when the
 * structured payload is trimmed from the tail, the blocking `deny` detail — the
 * assessment carrying the actionable "why" — is the last thing dropped, not the
 * first.
 */
export function orderAssessmentsBySeverity<T extends { action?: string }>(assessments: T[]): T[] {
  return [...assessments].sort(
    (a, b) => (SEVERITY_RANK[b.action ?? "none"] ?? 0) - (SEVERITY_RANK[a.action ?? "none"] ?? 0),
  );
}

const PathInput = z
  .object({
    path: z
      .string()
      .min(1, "path must be a non-empty repo-relative or absolute file path")
      .describe(
        "The file path to look up. Absolute or repo-relative both work (matched on suffix). Example: 'src/db/client.ts'.",
      ),
  })
  .strict();

export function registerWorkspaceTools(server: McpServer): void {
  server.registerTool(
    "workspace_get_file_context",
    {
      title: "Get workspace intelligence for a file",
      description: `Return behavioral intelligence about a single file from workspace.json BEFORE you edit it.

Combines two signals the current source tree cannot reveal on its own:
  - Fragility: whether this file is historically error-prone / high blast radius, with reason and evidence when available.
  - Co-change: which other files have historically been edited together with this one.

Call this before editing or creating a file. Treat a fragile result as a reason to make minimal, well-tested changes; treat co-change partners as candidates for related edits.

Args:
  - path (string): repo-relative or absolute file path.

Returns JSON:
  {
    "path": string,
    "fragile": boolean,
    "fragility": { "reason"?: string, "score"?: number, "evidence"?: string[] } | null,
    "coChangePartners": string[],
    "indexed": boolean,              // whether the file appears in the workspace file index
    "workspaceVersion": string | null
  }

Returns fragile:false with empty partners when the file has no recorded history (this is a real answer, not an error).`,
      inputSchema: PathInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path }): Promise<ToolResult> =>
      guarded(async () => {
        const ws = await loadWorkspace();
        const fragile = findFragile(ws, path);
        const partners = findCoChangePartners(ws, path);
        const indexed = isIndexed(ws, path);
        const tier = fragile ? deriveTier(fragile.evidence) : null;
        const assessment = decideEnforcement({
          path,
          fragile: Boolean(fragile),
          tier,
          reason: fragile?.reason,
          evidence: fragile?.evidence ?? [],
          coChangePartners: partners,
          changesetPaths: [path], // single-file view: partners are "missing" advisories
        });

        const output = {
          path,
          fragile: Boolean(fragile),
          fragility: fragile
            ? {
                tier, // derived mechanically from evidence; never producer-emitted
                ...(fragile.reason ? { reason: fragile.reason } : {}),
                ...(fragile.score !== undefined ? { score: fragile.score } : {}),
                evidence: fragile.evidence,
              }
            : null,
          coChangePartners: partners,
          guidance: assessment.message,
          indexed,
          workspaceVersion: ws.version ?? null,
        };

        const lines: string[] = [`File: ${path}`];
        if (fragile) {
          lines.push(
            `⚠ FRAGILE [tier ${tier}]${fragile.score !== undefined ? ` (score ${fragile.score})` : ""}${
              fragile.reason ? `: ${fragile.reason}` : ""
            }`,
          );
          if (fragile.evidence.length) {
            lines.push(`  evidence: ${fragile.evidence.map((e) => e.claim).join("; ")}`);
          }
        } else {
          lines.push("No recorded fragility. Absence of history is not evidence of safety.");
        }
        lines.push(
          partners.length
            ? `Co-change partners (${partners.length}): ${partners.join(", ")}`
            : "No co-change partners recorded.",
        );

        return {
          content: [{ type: "text", text: truncate(lines.join("\n")) }],
          structuredContent: boundStructured(output),
        };
      }),
  );

  server.registerTool(
    "workspace_get_cochange_partners",
    {
      title: "List co-change partners for a file",
      description: `Return the files that historically change together with the given file, per workspace.json.

Use after editing a file to check whether related files also need updating.

Args:
  - path (string): repo-relative or absolute file path.

Returns JSON: { "path": string, "partners": string[], "count": number }
Returns an empty partners array when none are recorded (a real answer, not an error).`,
      inputSchema: PathInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path }): Promise<ToolResult> =>
      guarded(async () => {
        const ws = await loadWorkspace();
        const partners = findCoChangePartners(ws, path);
        const output = { path, partners, count: partners.length };
        return {
          content: [
            {
              type: "text",
              text: truncate(
                partners.length
                  ? `${path} co-changes with:\n${partners.map((p) => `  - ${p}`).join("\n")}`
                  : `No co-change partners recorded for ${path}.`,
              ),
            },
          ],
          structuredContent: boundStructured(output),
        };
      }),
  );

  server.registerTool(
    "workspace_list_fragile_files",
    {
      title: "List fragile files in the workspace",
      description: `List all files flagged fragile in workspace.json, most fragile first (by score when present).

Use for orientation at the start of a task: it tells you which parts of the codebase carry the most historical risk.

Args:
  - limit (number, optional): max files to return (default 50, max 500).

Returns JSON:
  {
    "count": number,
    "total": number,
    "workspaceVersion": string | null,
    "files": [{ "path": string, "reason"?: string, "score"?: number }]
  }`,
      inputSchema: z
        .object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(500)
            .default(50)
            .describe("Maximum number of fragile files to return (default 50)."),
        })
        .strict().shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit }): Promise<ToolResult> =>
      guarded(async () => {
        const ws = await loadWorkspace();
        const sorted = [...ws.fragileFiles].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const sliced = sorted.slice(0, limit);
        const output = {
          count: sliced.length,
          total: ws.fragileFiles.length,
          workspaceVersion: ws.version ?? null,
          files: sliced.map((f) => ({
            path: f.path,
            ...(f.reason ? { reason: f.reason } : {}),
            ...(f.score !== undefined ? { score: f.score } : {}),
          })),
        };
        const text = sliced.length
          ? sliced
              .map((f) => `${f.score !== undefined ? `[${f.score}] ` : ""}${f.path}${f.reason ? ` — ${f.reason}` : ""}`)
              .join("\n")
          : "No fragile files recorded in this workspace.";
        return {
          content: [{ type: "text", text: truncate(text) }],
          structuredContent: boundStructured(output),
        };
      }),
  );

  server.registerTool(
    "workspace_assess_change",
    {
      title: "Assess a changeset against workspace intelligence",
      description: `Evaluate a SET of file paths (a proposed change) against workspace.json fragility and co-change history, and return a mechanical enforcement decision.

Decision semantics (derived, never model-emitted):
  - "deny": an evidenced-fragile file is touched while its recorded co-change partners are absent from the changeset. Include the partners or get explicit human approval.
  - "warn": evidenced-fragile file touched (partners covered), or co-change partners missing on a non-evidenced file.
  - "annotate": fragility asserted without evidence. Context only.
  - "none": no recorded history. This is NOT a safety approval; this tool never certifies a change as safe.

Args:
  - paths (string[]): repo-relative or absolute paths in the proposed change (1-200).

Returns JSON:
  {
    "action": "deny" | "warn" | "annotate" | "none",
    "assessments": [{ "path", "fragile", "tier", "coChangePartners", "missingPartners", "action", "message" }],
    "workspaceVersion": string | null
  }`,
      inputSchema: z
        .object({
          paths: z.array(z.string().min(1)).min(1).max(200).describe("File paths in the proposed changeset."),
        })
        .strict().shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ paths }): Promise<ToolResult> =>
      guarded(async () => {
        const ws = await loadWorkspace();
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
        const output = {
          action,
          // Severity-ordered so bounding trims low-severity noise before the deny detail.
          assessments: orderAssessmentsBySeverity(assessments),
          workspaceVersion: ws.version ?? null,
        };
        const interesting = assessments.filter((a) => a.action !== "none");
        const text =
          interesting.length > 0
            ? `Changeset action: ${action.toUpperCase()}\n${interesting.map((a) => `- ${a.message}`).join("\n")}`
            : "Changeset action: NONE. No recorded risk history for any touched file. Absence of history is not evidence of safety.";
        return {
          content: [{ type: "text", text: truncate(text) }],
          structuredContent: boundStructured(output),
        };
      }),
  );
}
