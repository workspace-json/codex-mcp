import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("published npx entrypoint", () => {
  it("exposes the executable npx derives from the scoped package name", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

    expect(pkg.bin["codex-mcp"]).toBe("scripts/install.mjs");
    expect(pkg.bin["workspacejson-codex-mcp"]).toBe("scripts/install.mjs");
  });
});

describe("runtime VERSION constant", () => {
  it("matches package.json (src/index.ts hardcodes it rather than importing the json)", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    const indexSource = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
    const match = indexSource.match(/const VERSION = "([^"]+)"/);
    expect(match?.[1]).toBe(pkg.version);
  });
});
