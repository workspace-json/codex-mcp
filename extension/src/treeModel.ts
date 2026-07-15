import type { IntelligenceView } from "./semanticModel.js";
import type { ReviewState } from "./reviewerVerdict.js";

/**
 * vscode-free construction of the `workspace.json` tree. Produces plain node
 * descriptions and the view badge; the provider (changesetTreeProvider.ts)
 * maps these to TreeItems with ThemeIcons, commands, and MarkdownString
 * tooltips. Kept import-free of vscode so the §9 renderer invariants (covered
 * always carries verification language; no SAFE/APPROVED/ALL CLEAR strings;
 * badge counts the actionable omissions) are testable under `node --test`.
 */

export type NodeKind =
  | "decisionFile"
  | "omissionCount"
  | "partner"
  | "covered"
  | "annotate"
  | "idle"
  | "sourceUnavailable"
  | "sourceFailed"
  | "changeUnknown"
  | "review";

export interface PlainNode {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  /** Repo-relative file this row opens, when it maps to a real file. */
  path?: string;
  children?: PlainNode[];
  reviewState?: ReviewState;
}

const POSIX_SEP = "/";

export function baseName(path: string): string {
  const idx = path.lastIndexOf(POSIX_SEP);
  return idx === -1 ? path : path.slice(idx + 1);
}

export function dirName(path: string): string {
  const idx = path.lastIndexOf(POSIX_SEP);
  return idx === -1 ? "" : path.slice(0, idx);
}

/** Human label for the reviewer plane. Never emits SAFE/APPROVED/ALL CLEAR (§3.2). */
export function reviewLabel(state: ReviewState): string {
  switch (state) {
    case "NOT_RUN":
      return "Not run";
    case "RUNNING":
      return "Reviewing…";
    case "PASS":
      return "Advisory review · PASS within scope";
    case "BLOCK":
      return "Advisory review · BLOCK";
    case "STALE":
      return "Review stale · change has moved";
    case "UNAVAILABLE":
      return "Reviewer unavailable";
    case "FAILED":
      return "Review failed";
    default:
      return "Review unknown";
  }
}

/** The action hint shown as the review row's description, or undefined when no action applies. */
export function reviewAction(state: ReviewState): string | undefined {
  if (state === "NOT_RUN" || state === "STALE" || state === "UNAVAILABLE" || state === "FAILED") return "Run review";
  return undefined;
}

/** Actionable omission count for the view badge, or undefined when there is nothing to badge. */
export function omissionBadge(view: IntelligenceView): { value: number; tooltip: string } | undefined {
  const value = view.currentChange.missingCount;
  if (value <= 0) return undefined;
  return { value, tooltip: `${value} evidenced partner ${value === 1 ? "omission" : "omissions"}` };
}

function reviewNode(view: IntelligenceView): PlainNode {
  const state = view.review.state;
  return {
    id: "review",
    kind: "review",
    label: "REVIEW",
    children: [
      {
        id: `review:${state}`,
        kind: "review",
        label: reviewLabel(state),
        description: reviewAction(state),
        reviewState: state,
      },
    ],
  };
}

/**
 * Build the change-plane nodes (everything above REVIEW). Availability is
 * surfaced explicitly and never collapsed into an empty/covered change (§6.2).
 */
export function buildChangeNodes(view: IntelligenceView): PlainNode[] {
  const { source, currentChange } = view;

  if (source.availability === "FAILED")
    return [
      {
        id: "source:failed",
        kind: "sourceFailed",
        label: "workspace.json unavailable",
        description: "file is malformed",
      },
    ];

  if (source.availability === "UNAVAILABLE")
    return [{ id: "source:unavailable", kind: "sourceUnavailable", label: "Evidence unavailable" }];

  if (source.availability !== "AVAILABLE")
    return [{ id: "source:unknown", kind: "sourceUnavailable", label: "Evidence unavailable" }];

  if (!currentChange.changesetKnown)
    return [{ id: "change:unknown", kind: "changeUnknown", label: "Current change unavailable" }];

  switch (currentChange.decision) {
    case "DENY":
      return currentChange.files.map((file) => {
        const count = file.missingPartners.length;
        return {
          id: `file:${file.path}`,
          kind: "decisionFile" as const,
          label: `DENY · ${baseName(file.path)}`,
          description: dirName(file.path) || undefined,
          path: file.path,
          // One causal line gives the nested partners meaning: the user should
          // not have to infer why these files hang under checkout.ts.
          children: [
            {
              id: `omitted:${file.path}`,
              kind: "omissionCount" as const,
              label: `${count} evidenced ${count === 1 ? "partner" : "partners"} omitted`,
              children: file.missingPartners.map((partner) => ({
                id: `partner:${file.path}:${partner}`,
                kind: "partner" as const,
                label: baseName(partner),
                description: [dirName(partner), "omitted"].filter(Boolean).join(" · "),
                path: partner,
              })),
            },
          ],
        };
      });
    case "PARTNER_SET_COVERED":
      return [
        {
          id: "covered",
          kind: "covered",
          label: "Partner set covered",
          description: "Verification still required",
        },
      ];
    case "ANNOTATE":
      return [
        {
          id: "annotate",
          kind: "annotate",
          label: "Recorded fragile",
          description: "no recorded partners",
        },
      ];
    default:
      return [{ id: "idle", kind: "idle", label: "No current changes" }];
  }
}

/** The full ordered tree: change plane, then the REVIEW plane. */
export function buildTree(view: IntelligenceView): PlainNode[] {
  return [...buildChangeNodes(view), reviewNode(view)];
}
