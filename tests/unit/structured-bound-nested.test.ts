import { describe, expect, it } from "vitest";
import { CHARACTER_LIMIT } from "../../src/constants.js";
import { boundStructured } from "../../src/tools/workspace.js";

/**
 * Re-review finding #1/#2: boundStructured must guarantee the cap even when the
 * bulk is NOT a top-level array (nested fragility.evidence[] + the top-level
 * `guidance` string, the workspace_get_file_context shape), and it must never
 * flag `truncated` on a payload that still exceeds the cap.
 */

describe("boundStructured with nested/scalar bulk (get_file_context shape)", () => {
  const huge = {
    path: "src/db/client.ts",
    fragile: true,
    fragility: {
      tier: "OBSERVED",
      reason: "y".repeat(500),
      evidence: Array.from({ length: 400 }, (_, i) => ({ claim: `c${i} ${"z".repeat(300)}` })),
    },
    coChangePartners: [],
    guidance: "g".repeat(5000),
    indexed: true,
    workspaceVersion: null,
  };

  it("bounds the serialized structuredContent to the cap", () => {
    const out = boundStructured(huge);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
  });

  it("only flags truncated when the result actually fits the cap (no lying flag)", () => {
    const out = boundStructured(huge);
    if (out.truncated === true) {
      expect(JSON.stringify(out).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
    }
  });

  it("preserves the load-bearing scalar signals (path, fragile, tier)", () => {
    const out = boundStructured(huge);
    expect(out.path).toBe("src/db/client.ts");
    expect(out.fragile).toBe(true);
    expect((out.fragility as { tier?: string }).tier).toBe("OBSERVED");
  });
});
