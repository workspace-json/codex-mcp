/**
 * Shared constants for the workspace.json Codex MCP server.
 */

// Candidate locations for the workspace.json file, in priority order.
// The canonical location per the workspace.json standard is `.agents/workspace.json`.
// The others are accepted as fallbacks so the server works across consumer conventions.
export const WORKSPACE_JSON_CANDIDATES = [
  ".agents/workspace.json",
  ".workspace.json",
  "workspace.json",
  ".vreko/workspace.json",
] as const;

// Environment override: point directly at a workspace.json file.
export const ENV_WORKSPACE_PATH = "WORKSPACE_JSON_PATH";
// Environment override: root directory to search from (defaults to process.cwd()).
export const ENV_WORKSPACE_ROOT = "WORKSPACE_JSON_ROOT";

// Cap on how much text we return in any single tool response, to protect the
// agent's context window. Large lists are truncated with an explicit note.
export const CHARACTER_LIMIT = 12_000;

// Server-wide guidance handed to Codex during MCP initialization. Codex reads the
// `instructions` field and treats it as standing guidance for the whole server.
// Keep the first ~512 characters self-contained: that is the window most reliably
// consulted when the agent decides whether to reach for a tool.
export const SERVER_INSTRUCTIONS = [
  "This server exposes behavioral intelligence about the current workspace, sourced from a workspace.json file: which files are FRAGILE (historically error-prone or high-blast-radius) and which files CO-CHANGE (tend to be edited together).",
  "Before editing or creating any file, call workspace_get_file_context with the target path. If the file is fragile, proceed carefully and prefer minimal, well-tested changes. If it has co-change partners, inspect them for related updates you may also need to make.",
  "This is history the current source tree cannot tell you on its own. Use it as a prior, not a command: the human's intent still wins. All tools are read-only and operate on a local file; nothing leaves the machine.",
].join(" ");
