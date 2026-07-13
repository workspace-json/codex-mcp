import { describe, expect, it } from "vitest";
import { CHARACTER_LIMIT } from "../../src/constants.js";
import { boundStructured } from "../../src/tools/workspace.js";

/**
 * HAC-131: the CHARACTER_LIMIT cap must also govern structuredContent, not only
 * content[].text. A large fragile-file list previously serialized to ~134 KB on
 * the structured channel despite the 12 KB cap.
 */

describe("boundStructured", () => {
  it("caps a large structured payload at CHARACTER_LIMIT and flags truncation", () => {
    const files = Array.from({ length: 300 }, (_, i) => ({
      path: `src/pkg/module-${i}.ts`,
      reason: "x".repeat(400),
      score: 300 - i,
    }));
    const output = boundStructured({ count: files.length, total: files.length, files });

    expect(JSON.stringify(output).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(output.truncated).toBe(true);
    expect(output.total).toBe(300);
    const kept = output.files as unknown[];
    expect(output.count).toBe(kept.length);
    expect(kept.length).toBeLessThan(300);
  });

  it("passes a small payload through unchanged (no truncation flag)", () => {
    const output = boundStructured({ count: 1, total: 1, files: [{ path: "src/a.ts" }] });
    expect(output.truncated).toBeUndefined();
    expect((output.files as unknown[]).length).toBe(1);
  });
});
