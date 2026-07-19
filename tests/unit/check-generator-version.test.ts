import { describe, expect, it } from "vitest";
import { findVersionMismatches } from "../../scripts/check-generator-version.mjs";

describe("findVersionMismatches", () => {
  it("passes with no references", () => {
    expect(findVersionMismatches([])).toEqual([]);
  });

  it("passes when every surface agrees", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.3" },
    ];
    expect(findVersionMismatches(refs)).toEqual([]);
  });

  it("fails when surfaces disagree with each other", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.2" },
    ];
    const violations = findVersionMismatches(refs);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/disagrees across surfaces/);
    expect(violations[0]).toContain("README.md -> 0.4.3");
    expect(violations[0]).toContain("scripts/install.mjs -> 0.4.2");
  });

  it("does not fail merely because the pin is behind the registry's latest", () => {
    // Intentional non-behavior: the pin is the contract; an upstream release
    // moving ahead must not red downstream CI. Reconciliation against the
    // installed version is the redesign tracked in HAC-204.
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.3" },
    ];
    expect(findVersionMismatches(refs)).toEqual([]);
  });
});
