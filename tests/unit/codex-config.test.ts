import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * HAC-128: the committed project config Codex loads directly must launch the MCP
 * server, not the installer. The installer binary dispatches zero args to
 * runInstall(); only the "server" arg starts the stdio server.
 */

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, "../../.codex/config.toml");

describe("committed .codex/config.toml", () => {
  it("passes the 'server' arg so Codex starts the MCP server, not the installer", () => {
    const toml = readFileSync(configPath, "utf8");
    const match = toml.match(/args\s*=\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const args = (match?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    expect(args).toContain("server");
  });
});
