import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("project Codex configuration", () => {
  const config = readFileSync(resolve(process.cwd(), ".codex/config.toml"), "utf8");

  it("starts the MCP server instead of the installer", () => {
    expect(config).toContain('args = ["-y", "@workspacejson/codex-mcp", "server"]');
  });

  it("registers the project-scoped adversarial reviewer", () => {
    expect(config).toContain("[agents.adversarial_reviewer]");
    expect(config).toContain('config_file = "./agents/adversarial-reviewer.toml"');
  });

  it("keeps the repo marketplace entry aligned with the plugin manifest", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), ".codex-plugin/plugin.json"), "utf8"));
    const marketplace = JSON.parse(readFileSync(resolve(process.cwd(), ".agents/plugins/marketplace.json"), "utf8"));
    expect(manifest.name).toBe("workspace-json");
    expect(manifest.author.name).toBe("workspace.json");
    expect(marketplace.plugins).toContainEqual(
      expect.objectContaining({
        name: manifest.name,
        source: { source: "local", path: "./" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      }),
    );
  });
});
