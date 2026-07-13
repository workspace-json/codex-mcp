import { describe, expect, it } from "vitest";
import { CHARACTER_LIMIT } from "../../src/constants.js";
import { boundStructured } from "../../src/tools/workspace.js";

/**
 * HAC-131 hardening (Copilot PR review, High): boundStructured's docstring
 * promises the serialized result is <= CHARACTER_LIMIT, but the reduction loop
 * can exit via `break` (nothing left to reduce) or the guard limit and then
 * return an over-cap payload while flagging `truncated: true`. That is the
 * dishonest-flag defect this function exists to prevent. The guarantee must hold
 * for ANY input, including one whose bulk is neither a trimmable array nor a long
 * string (many short scalar fields — the reducer cannot shrink it).
 */

describe("boundStructured guarantees the cap for irreducible payloads", () => {
  it("returns within CHARACTER_LIMIT when the bulk is short scalar fields (no arrays/long strings)", () => {
    const scalarHeavy: Record<string, unknown> = { path: "src/x.ts", fragile: true, tier: "OBSERVED" };
    for (let i = 0; i < 1200; i++) scalarHeavy[`metric_field_number_${i}`] = i;
    // Precondition: this is genuinely over the cap and has nothing the reducer can trim.
    expect(JSON.stringify(scalarHeavy).length).toBeGreaterThan(CHARACTER_LIMIT);

    const out = boundStructured(scalarHeavy);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
  });

  it("never flags truncated on a result that still exceeds the cap", () => {
    const scalarHeavy: Record<string, unknown> = {};
    for (let i = 0; i < 1200; i++) scalarHeavy[`metric_field_number_${i}`] = i;
    const out = boundStructured(scalarHeavy);
    if (out.truncated === true) {
      expect(JSON.stringify(out).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
    }
  });
});
