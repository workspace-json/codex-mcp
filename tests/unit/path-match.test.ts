import { describe, expect, it } from "vitest";
import { normalizeKey, pathsMatch } from "../../src/path-match.js";

describe("normalizeKey", () => {
  it("strips leading ./ and trailing slashes", () => {
    expect(normalizeKey("./src/db/client.ts")).toBe("src/db/client.ts");
    expect(normalizeKey("src/db/client.ts/")).toBe("src/db/client.ts");
  });

  it("converts backslashes to forward slashes", () => {
    expect(normalizeKey("src\\db\\client.ts")).toBe("src/db/client.ts");
  });

  it("collapses redundant separators", () => {
    expect(normalizeKey("src//db//client.ts")).toBe("src/db/client.ts");
  });

  it("does not alter already-normal keys", () => {
    expect(normalizeKey("src/db/client.ts")).toBe("src/db/client.ts");
  });
});

describe("pathsMatch", () => {
  it("matches exact repo-relative paths", () => {
    expect(pathsMatch("src/db/client.ts", "src/db/client.ts")).toBe(true);
  });

  it("matches after leading ./ normalization", () => {
    expect(pathsMatch("./src/db/client.ts", "src/db/client.ts")).toBe(true);
    expect(pathsMatch("src/db/client.ts", "./src/db/client.ts")).toBe(true);
  });

  it("matches an absolute query to a repo-relative stored key with suffix", () => {
    expect(pathsMatch("/abs/repo/src/db/client.ts", "src/db/client.ts")).toBe(true);
  });

  it("does not match partial relative paths", () => {
    expect(pathsMatch("db/client.ts", "src/db/client.ts")).toBe(false);
    expect(pathsMatch("client.ts", "src/db/client.ts")).toBe(false);
  });

  it("does not let a bare single-segment stored key match an arbitrary absolute path", () => {
    expect(pathsMatch("/abs/repo/client.ts", "client.ts")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(pathsMatch("src/DB/client.ts", "src/db/client.ts")).toBe(false);
  });
});
