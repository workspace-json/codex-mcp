import { describe, expect, it } from "vitest";
import { CHARACTER_LIMIT } from "../../src/constants.js";
import { boundStructured } from "../../src/tools/workspace.js";

function size(value: unknown): number {
  return JSON.stringify(value).length;
}

describe("boundStructured", () => {
  it("leaves small results unchanged", () => {
    const value = { path: "src/a.ts", fragile: false };
    expect(boundStructured(value)).toBe(value);
  });

  it("bounds large top-level lists and reports an honest returned count", () => {
    const value = {
      count: 500,
      total: 500,
      files: Array.from({ length: 500 }, (_, index) => ({
        path: `src/very-long-directory/file-${index}.ts`,
        reason: "historical regression ".repeat(8),
      })),
    };
    const bounded = boundStructured(value);
    expect(size(bounded)).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(bounded.truncated).toBe(true);
    expect(Number(bounded.omitted)).toBeGreaterThan(0);
    expect(bounded.count).toBe((bounded.files as unknown[]).length);
    expect(bounded.total).toBe(500);
  });

  it("bounds nested evidence and long guidance strings", () => {
    const value = {
      path: "src/a.ts",
      fragile: true,
      fragility: {
        tier: "OBSERVED",
        evidence: Array.from({ length: 400 }, (_, index) => ({
          claim: `claim-${index}-${"x".repeat(300)}`,
        })),
      },
      guidance: "next step ".repeat(20_000),
    };
    const bounded = boundStructured(value);
    expect(size(bounded)).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(bounded.path).toBe("src/a.ts");
    expect(bounded.fragile).toBe(true);
    expect(bounded.truncated).toBe(true);
  });

  it("preserves the primary deny assessment while bounding its details", () => {
    const value = {
      action: "deny",
      assessments: [
        {
          path: "src/checkout.ts",
          action: "deny",
          message: "missing partners ".repeat(5_000),
          missingPartners: Array.from({ length: 800 }, (_, index) => `src/partner-${index}.ts`),
        },
      ],
    };
    const bounded = boundStructured(value);
    const assessments = bounded.assessments as Array<Record<string, unknown>>;
    expect(size(bounded)).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(bounded.action).toBe("deny");
    expect(assessments).toHaveLength(1);
    expect(assessments[0]?.action).toBe("deny");
    expect(assessments[0]?.path).toBe("src/checkout.ts");
  });

  it("moves a later deny to the protected primary position before bounding", () => {
    const value = {
      action: "deny",
      assessments: [
        { path: "src/clean.ts", action: "none", message: "no recorded risk" },
        {
          path: "src/checkout.ts",
          action: "deny",
          message: `missing partners ${"x".repeat(20_000)}`,
          missingPartners: ["src/auth.ts"],
        },
      ],
    };
    const bounded = boundStructured(value);
    const assessments = bounded.assessments as Array<Record<string, unknown>>;
    expect(size(bounded)).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(bounded.action).toBe("deny");
    expect(assessments[0]).toMatchObject({ path: "src/checkout.ts", action: "deny" });
  });

  it("reports returned and total counts honestly for bounded partner lists", () => {
    const partners = Array.from({ length: 500 }, (_, index) => `src/${"long/".repeat(6)}partner-${index}.ts`);
    const bounded = boundStructured({ path: "src/a.ts", partners, count: partners.length });
    expect(size(bounded)).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(bounded.total).toBe(500);
    expect(bounded.count).toBe((bounded.partners as unknown[]).length);
  });
});
