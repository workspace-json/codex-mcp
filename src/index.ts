#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isVerifyEnabled } from "./config.js";
import { SERVER_INSTRUCTIONS } from "./constants.js";
import { registerWorkspaceTools } from "./tools/workspace.js";

const VERSION = "0.1.7";

function buildServer(): McpServer {
  const server = new McpServer(
    {
      name: "workspacejson-codex-mcp",
      version: VERSION,
    },
    {
      // Codex reads `instructions` during initialization and uses it as
      // server-wide standing guidance. This is what makes the fragility /
      // co-change check proactive rather than only-when-asked.
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  registerWorkspaceTools(server);
  return server;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(
      [
        `workspacejson-codex-mcp v${VERSION}`,
        "",
        "MCP server exposing workspace.json fragility + co-change intelligence to Codex.",
        "",
        "Transport: stdio (spawned by an MCP client such as Codex).",
        "",
        "Environment:",
        "  WORKSPACE_JSON_PATH   Explicit path to a workspace.json file.",
        "  WORKSPACE_JSON_ROOT   Root dir to search (default: cwd).",
        "  WJSON_VERIFY=1        Opt in to the VERIFIED tier: re-run recorded read-only",
        "                        git commands to confirm evidence reproduces. Off by",
        "                        default; CLI/CI-time only (never on the hook hot path).",
        "",
        "Codex config (.codex/config.toml):",
        "  [mcp_servers.workspacejson]",
        '  command = "npx"',
        '  args = ["-y", "@workspacejson/codex-mcp", "server"]',
        "",
      ].join("\n"),
    );
    return;
  }

  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logging on stdio transports; stdout carries the protocol.
  console.error(`workspacejson-codex-mcp v${VERSION} ready on stdio${isVerifyEnabled() ? " (verify mode ON)" : ""}`);
}

main().catch((error) => {
  console.error("Fatal:", error instanceof Error ? error.stack : error);
  process.exit(1);
});
