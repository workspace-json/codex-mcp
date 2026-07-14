#!/usr/bin/env node
/**
 * HAC-91 full installer path.
 *
 * Usage:
 *   npx @workspacejson/codex-mcp install
 *   node scripts/install.mjs
 *   node scripts/install.mjs --with-hook
 *   node scripts/install.mjs uninstall
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
import { chmod, cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const hookPath = resolve(packageRoot, "hooks", "pre-edit-check.mjs");
const reviewerSource = resolve(packageRoot, ".codex", "agents", "adversarial-reviewer.toml");
const distSource = resolve(packageRoot, "dist");

const MCP_HEADER = "[mcp_servers.workspacejson]";
const MCP_MARKER = "# workspacejson-codex-mcp managed MCP block";
// The "server" arg is required because this same binary is the install script
// when called with "install" and the MCP server when called with "server".
const MCP_BLOCK = [
  MCP_HEADER,
  MCP_MARKER,
  'command = "npx"',
  'args = ["-y", "@workspacejson/codex-mcp", "server"]',
].join("\n");

const AGENT_HEADER = "[agents.adversarial_reviewer]";
const AGENT_MARKER = "# workspacejson-codex-mcp managed reviewer block";
const AGENT_BLOCK = [
  AGENT_HEADER,
  AGENT_MARKER,
  'description = "Read-only GPT-5.6 reviewer for correctness, evidence integrity, and unsupported claims."',
  'config_file = "./agents/adversarial-reviewer.toml"',
  'nickname_candidates = ["Aegis", "Argus", "Sentinel"]',
].join("\n");

const HOOK_MARKER = "# workspacejson-codex-mcp PreToolUse hook";
const RUNTIME_MARKER = ".workspacejson-codex-mcp-owned";

function blockHasMarker(content, header, marker) {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return false;
  let end = start + 1;
  while (end < lines.length && !lines[end].trimStart().startsWith("[")) end++;
  return lines.slice(start, end).some((line) => line.trim() === marker);
}

function assertAvailable(content, header, marker) {
  if (content.split("\n").some((line) => line.trim() === header) && !blockHasMarker(content, header, marker)) {
    throw new Error(`Refusing to overwrite unmanaged Codex configuration section ${header}`);
  }
}

async function writeAtomic(path, content) {
  const temporary = `${path}.workspacejson-${process.pid}.tmp`;
  let existingMode;
  try {
    existingMode = (await stat(path)).mode & 0o777;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  await writeFile(temporary, content, { encoding: "utf8", mode: existingMode });
  if (existingMode !== undefined) await chmod(temporary, existingMode);
  await rename(temporary, path);
}

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

function setTomlBlock(content, header, blockText) {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return `${blockText}\n`;
  }

  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) {
    return `${trimmed}\n\n${blockText}\n`;
  }

  let end = start + 1;
  while (end < lines.length && !lines[end].trimStart().startsWith("[")) {
    end++;
  }

  const before = lines.slice(0, start).join("\n");
  const after = lines.slice(end).join("\n");
  const parts = [before, blockText, after].filter((s) => s.length > 0);
  return `${parts.join("\n")}\n`;
}

function normalizeTomlEdges(content) {
  const withoutLeadingBlankLines = content.replace(/^(?:[ \t]*\r?\n)+/, "");
  const withoutBlankTail = withoutLeadingBlankLines.replace(/(?:\r?\n[ \t]*)+$/, "");
  return withoutBlankTail.length > 0 ? `${withoutBlankTail}\n` : "";
}

function removeTomlBlock(content, header) {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return content;
  let end = start + 1;
  while (end < lines.length && !lines[end].trimStart().startsWith("[")) end++;
  return normalizeTomlEdges([...lines.slice(0, start), ...lines.slice(end)].join("\n"));
}

function removeManagedHook(content) {
  const lines = content.split("\n");
  const marker = lines.findIndex((line) => line.trim() === HOOK_MARKER);
  if (marker === -1) return content;

  let start = marker;
  while (start > 0 && lines[start].trim() !== "[[hooks.PreToolUse]]") start--;

  let end = marker + 1;
  let consumedInnerHeader = false;
  while (end < lines.length) {
    const line = lines[end].trim();
    if (line.startsWith("[")) {
      if (!consumedInnerHeader && line === "[[hooks.PreToolUse.hooks]]") {
        consumedInnerHeader = true;
      } else {
        break;
      }
    }
    end++;
  }
  return normalizeTomlEdges([...lines.slice(0, start), ...lines.slice(end)].join("\n"));
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
  const agentDir = resolve(codexDir, "agents");
  const reviewerPath = resolve(agentDir, "adversarial-reviewer.toml");
  const managedRoot = resolve(codexDir, "workspacejson-codex-mcp");
  const managedHookPath = resolve(managedRoot, "hooks", "pre-edit-check.mjs");
  const managedMarkerPath = resolve(managedRoot, RUNTIME_MARKER);

  await mkdir(agentDir, { recursive: true });

  let content = "";
  try {
    content = await readFile(configPath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  assertAvailable(content, MCP_HEADER, MCP_MARKER);
  assertAvailable(content, AGENT_HEADER, AGENT_MARKER);
  if (existsSync(reviewerPath) && !blockHasMarker(content, AGENT_HEADER, AGENT_MARKER)) {
    throw new Error(`Refusing to overwrite unmanaged reviewer file ${reviewerPath}`);
  }
  if (existsSync(managedRoot) && !existsSync(managedMarkerPath)) {
    throw new Error(`Refusing to overwrite unmanaged runtime directory ${managedRoot}`);
  }

  content = setTomlBlock(content, MCP_HEADER, MCP_BLOCK);
  content = setTomlBlock(content, AGENT_HEADER, AGENT_BLOCK);

  if (withHook) {
    content = addHookBlock(removeManagedHook(content), managedHookPath);
    await mkdir(resolve(managedRoot, "hooks"), { recursive: true });
    await cp(hookPath, managedHookPath);
    await cp(distSource, resolve(managedRoot, "dist"), { recursive: true, force: true });
    await writeAtomic(managedMarkerPath, "owned by @workspacejson/codex-mcp\n");
  }

  await writeAtomic(configPath, content);
  if (reviewerSource !== reviewerPath) {
    await writeAtomic(reviewerPath, await readFile(reviewerSource, "utf8"));
  }

  console.log(`Wrote ${configPath}`);
  console.log(`Installed read-only GPT-5.6 reviewer at ${reviewerPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart Codex.");
  console.log("  2. Run /mcp in the TUI to confirm workspacejson is connected.");
  console.log("  3. Ask Codex to use the adversarial_reviewer subagent on a completed change.");
  if (withHook) {
    console.log("  4. PreToolUse hook is active for apply_patch.");
  }
  console.log("");
  console.log("Add this line to AGENTS.md to reinforce the behavior:");
  console.log(
    "  Before editing or creating a file, call workspace_get_file_context on the target path to check fragility and co-change partners.",
  );
}

async function runUninstall() {
  const repoRoot = await findRepoRoot(process.cwd());
  const codexDir = resolve(repoRoot, ".codex");
  const configPath = resolve(codexDir, "config.toml");
  const reviewerPath = resolve(codexDir, "agents", "adversarial-reviewer.toml");
  const managedRoot = resolve(codexDir, "workspacejson-codex-mcp");
  const ownsRuntime = existsSync(resolve(managedRoot, RUNTIME_MARKER));

  let content = "";
  try {
    content = await readFile(configPath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const ownsMcp = blockHasMarker(content, MCP_HEADER, MCP_MARKER);
  const ownsAgent = blockHasMarker(content, AGENT_HEADER, AGENT_MARKER);
  if (ownsMcp) content = removeTomlBlock(content, MCP_HEADER);
  if (ownsAgent) content = removeTomlBlock(content, AGENT_HEADER);
  content = removeManagedHook(content);
  await writeAtomic(configPath, normalizeTomlEdges(content));
  if (ownsAgent) await rm(reviewerPath, { force: true });
  if (ownsRuntime) await rm(managedRoot, { recursive: true, force: true });

  console.log(`Removed workspacejson configuration from ${configPath}`);
  console.log(`Removed ${reviewerPath}`);
  console.log("Unrelated Codex configuration was preserved.");
}

async function runServer() {
  await import(resolve(packageRoot, "dist", "index.js"));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "install" || (args[0] === "--with-hook" && args.length === 1)) {
    await runInstall();
  } else if (args[0] === "uninstall") {
    await runUninstall();
  } else if (args[0] === "server") {
    await runServer();
  } else {
    console.error("Unknown command:", args[0]);
    console.error(
      "Usage: node scripts/install.mjs [install] [--with-hook] | node scripts/install.mjs uninstall | node scripts/install.mjs server",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Install failed:", err.message);
  process.exit(1);
});
