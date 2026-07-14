import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CLI help configuration example", () => {
  it("includes the server subcommand", () => {
    const source = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
    expect(source).toContain('@workspacejson/codex-mcp", "server');
    expect(source).not.toContain("@workspacejson/codex-mcp\"]'");
  });
});
