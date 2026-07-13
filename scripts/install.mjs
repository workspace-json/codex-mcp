#!/usr/bin/env node
/**
 * HAC-91 full installer path.
 *
 * Usage:
 *   npx @workspacejson/codex-mcp install
 *   node scripts/install.mjs
 *   node scripts/install.mjs --with-hook
 *
 * Writes [mcp_servers.workspacejson] to .codex/config.toml at the current repo
 * root, idempotently. With --with-hook, also appends a single PreToolUse hook
 * stanza for apply_patch. Never overwrites unrelated config.
 *
 * When run without the "install" subcommand (or as the package binary), it
 * proxies to the built MCP server so the same package is both the server and
 * the installer.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const hookPath = resolve(packageRoot, "hooks", "pre-edit-check.mjs");

const MCP_HEADER = "[mcp_servers.workspacejson]";
// The "server" arg is required because this same binary is the install script
// when called with "install" and the MCP server when called with "server".
const MCP_BLOCK = [MCP_HEADER, 'command = "npx"', 'args = ["-y", "@workspacejson/codex-mcp", "server"]'].join("\n");

const HOOK_MARKER = "# workspacejson-codex-mcp PreToolUse hook";

function buildHookBlock(commandPath) {
  return [
    "",
    "[[hooks.PreToolUse]]",
    HOOK_MARKER,
    'matcher = "^apply_patch$"',
    "[[hooks.PreToolUse.hooks]]",
    'type = "command"',
    `command = 'node "${commandPath}"'`,
    "timeout = 10",
    'statusMessage = "Checking workspace fragility and co-change history"',
  ].join("\n");
}

async function findRepoRoot(cwd) {
  try {
    const { execSync } = await import("node:child_process");
    const out = execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim();
  } catch {
    // No git: walk up to a plausible project root.
    let dir = resolve(cwd);
    const searched = new Set();
    while (!searched.has(dir)) {
      searched.add(dir);
      if (
        existsSync(resolve(dir, ".git")) ||
        existsSync(resolve(dir, "package.json")) ||
        existsSync(resolve(dir, ".agents")) ||
        existsSync(resolve(dir, "workspace.json"))
      ) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return cwd;
  }
}

function setMcpBlock(content, blockText) {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return `${blockText}\n`;
  }

  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === MCP_HEADER);
  if (start === -1) {
    return `${trimmed}\n\n${blockText}\n`;
  }

  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("[")) {
    end++;
  }

  const before = lines.slice(0, start).join("\n");
  const after = lines.slice(end).join("\n");
  const parts = [before, blockText, after].filter((s) => s.length > 0);
  return `${parts.join("\n")}\n`;
}

function addHookBlock(content, commandPath) {
  if (content.includes(HOOK_MARKER)) {
    return content;
  }
  return `${content.trimEnd() + buildHookBlock(commandPath)}\n`;
}

async function runInstall() {
  const withHook = process.argv.includes("--with-hook");
  const repoRoot = await findRepoRoot(process.cwd());
  const codexDir = resolve(repoRoot, ".codex");
  const configPath = resolve(codexDir, "config.toml");

  await mkdir(codexDir, { recursive: true });

  let content = "";
  try {
    content = await readFile(configPath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  content = setMcpBlock(content, MCP_BLOCK);

  if (withHook) {
    content = addHookBlock(content, hookPath);
  }

  await writeFile(configPath, content, "utf8");

  console.log(`Wrote ${configPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart Codex.");
  console.log("  2. Run /mcp in the TUI to confirm workspacejson is connected.");
  if (withHook) {
    console.log("  3. PreToolUse hook is active for apply_patch.");
  }
  console.log("");
  console.log("Add this line to AGENTS.md to reinforce the behavior:");
  console.log(
    "  Before editing or creating a file, call workspace_get_file_context on the target path to check fragility and co-change partners.",
  );
}

async function runServer() {
  await import(resolve(packageRoot, "dist", "index.js"));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "install" || (args[0] === "--with-hook" && args.length === 1)) {
    await runInstall();
  } else if (args[0] === "server") {
    await runServer();
  } else {
    console.error("Unknown command:", args[0]);
    console.error("Usage: node scripts/install.mjs [install] [--with-hook] | node scripts/install.mjs server");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Install failed:", err.message);
  process.exit(1);
});
