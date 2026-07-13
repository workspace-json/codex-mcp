import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT } from "../constants.js";
import {
  loadWorkspace,
  findFragile,
  findCoChangePartners,
  isIndexed,
} from "../services/workspace.js";
import { deriveTier, decideEnforcement, aggregateAction } from "../evidence.js";
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
          structuredContent: output,
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
          structuredContent: output,
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
              .map(
                (f) =>
                  `${f.score !== undefined ? `[${f.score}] ` : ""}${f.path}${f.reason ? ` — ${f.reason}` : ""}`,
              )
              .join("\n")
          : "No fragile files recorded in this workspace.";
        return {
          content: [{ type: "text", text: truncate(text) }],
          structuredContent: output,
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
          paths: z
            .array(z.string().min(1))
            .min(1)
            .max(200)
            .describe("File paths in the proposed changeset."),
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
          assessments,
          workspaceVersion: ws.version ?? null,
        };
        const interesting = assessments.filter((a) => a.action !== "none");
        const text =
          interesting.length > 0
            ? `Changeset action: ${action.toUpperCase()}\n` +
              interesting.map((a) => `- ${a.message}`).join("\n")
            : "Changeset action: NONE. No recorded risk history for any touched file. Absence of history is not evidence of safety.";
        return {
          content: [{ type: "text", text: truncate(text) }],
          structuredContent: output,
        };
      }),
  );
}
