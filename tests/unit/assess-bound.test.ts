import { describe, expect, it } from "vitest";
import { CHARACTER_LIMIT } from "../../src/constants.js";
import { boundStructured, orderAssessmentsBySeverity } from "../../src/tools/workspace.js";

/**
 * Re-review finding #3: when assess_change's structuredContent is bounded, the
 * highest-severity (deny) assessment — the one carrying the actionable "why" —
 * must survive. Ordering deny-first + tail-drop preserves it; a lone huge deny
 * is preserved by trimming its internals rather than dropping the record.
 */

describe("orderAssessmentsBySeverity", () => {
  it("orders deny > warn > annotate > none", () => {
    const input = [{ action: "none" }, { action: "warn" }, { action: "deny" }, { action: "annotate" }];
    expect(orderAssessmentsBySeverity(input).map((a) => a.action)).toEqual(["deny", "warn", "annotate", "none"]);
  });
});

describe("boundStructured preserves the deny detail", () => {
  it("keeps the deny assessment when trimming a large multi-file changeset", () => {
    const deny = {
      path: "src/db/client.ts",
      action: "deny",
      tier: "OBSERVED",
      missingPartners: ["src/db/schema.ts"],
      message: `BLOCK: ${"m".repeat(2000)}`,
    };
    const none = Array.from({ length: 400 }, (_, i) => ({ path: `src/x${i}.ts`, action: "none", message: "ok" }));
    const assessments = orderAssessmentsBySeverity([...none, deny]);
    const out = boundStructured({ action: "deny", assessments, workspaceVersion: null });

    expect(JSON.stringify(out).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(out.action).toBe("deny");
    const kept = out.assessments as Array<{ action: string; path: string }>;
    expect(kept.length).toBeGreaterThan(0);
    expect(kept[0].action).toBe("deny");
    expect(kept[0].path).toBe("src/db/client.ts");
  });

  it("keeps a single huge deny by trimming its internals, not dropping the record", () => {
    const deny = {
      path: "src/db/client.ts",
      action: "deny",
      tier: "OBSERVED",
      missingPartners: Array.from({ length: 800 }, (_, i) => `src/p${i}.ts`),
      message: `BLOCK: ${"m".repeat(20000)}`,
    };
    const out = boundStructured({ action: "deny", assessments: [deny], workspaceVersion: null });

    expect(JSON.stringify(out).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
    const kept = out.assessments as Array<{ action: string; path: string }>;
    expect(kept.length).toBe(1);
    expect(kept[0].action).toBe("deny");
    expect(kept[0].path).toBe("src/db/client.ts");
  });
});
