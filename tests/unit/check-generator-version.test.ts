import { describe, expect, it } from "vitest";
import { findVersionMismatches } from "../../scripts/check-generator-version.mjs";

describe("findVersionMismatches", () => {
  it("passes with no references", () => {
    expect(findVersionMismatches([], null)).toEqual([]);
  });

  it("passes when every surface agrees and the registry wasn't reachable", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.3" },
    ];
    expect(findVersionMismatches(refs, null)).toEqual([]);
  });

  it("passes when every surface agrees and matches the registry", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.3" },
    ];
    expect(findVersionMismatches(refs, "0.4.3")).toEqual([]);
  });

  it("fails when surfaces disagree with each other", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.2" },
    ];
    const violations = findVersionMismatches(refs, null);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/disagrees across surfaces/);
    expect(violations[0]).toContain("README.md -> 0.4.3");
    expect(violations[0]).toContain("scripts/install.mjs -> 0.4.2");
  });

  it("fails when every surface agrees but is behind the registry", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.3" },
    ];
    const violations = findVersionMismatches(refs, "0.4.4");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/registry's current version is 0\.4\.4/);
  });

  it("reports only the cross-surface disagreement, not also a registry mismatch, when both would fail", () => {
    const refs = [
      { file: "README.md", version: "0.4.3" },
      { file: "scripts/install.mjs", version: "0.4.2" },
    ];
    const violations = findVersionMismatches(refs, "0.4.4");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/disagrees across surfaces/);
  });
});
