import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const created: string[] = [];

afterEach(() => {
  for (const path of created.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("fallback installer", () => {
  it("installs the server config and hook idempotently without a custom reviewer agent", () => {
    const target = mkdtempSync(resolve(tmpdir(), "wjson-install-"));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");
    const codexDir = resolve(target, ".codex");
    mkdirSync(codexDir, { recursive: true });
    const configPath = resolve(codexDir, "config.toml");

    const install = () =>
      spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "install", "--with-hook"], {
        cwd: target,
        encoding: "utf8",
      });

    const first = install();
    expect(first.status, first.stderr).toBe(0);
    const second = install();
    expect(second.status, second.stderr).toBe(0);

    const config = readFileSync(configPath, "utf8");
    expect(config).toContain('args = ["-y", "@workspacejson/codex-mcp", "server"]');
    expect(config.match(/\[mcp_servers\.workspacejson\]/g)).toHaveLength(1);
    expect(config.match(/# workspacejson-codex-mcp PreToolUse hook/g)).toHaveLength(1);
    expect(config).toContain(resolve(target, ".codex/workspacejson-codex-mcp/hooks/pre-edit-check.mjs"));
    expect(existsSync(resolve(target, ".codex/workspacejson-codex-mcp/dist/index.js"))).toBe(true);

    writeFileSync(configPath, `approval_policy = "on-request"\n\n${config}`);
    const uninstall = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "uninstall"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);
    const after = readFileSync(configPath, "utf8");
    expect(after).toContain('approval_policy = "on-request"');
    expect(after).not.toContain("[mcp_servers.workspacejson]");
    expect(after).not.toContain("workspacejson-codex-mcp PreToolUse hook");

    // Regression: the managed hook must also be removed when it is the first
    // remaining TOML section (no unrelated prefix creates a leading newline).
    writeFileSync(configPath, config);
    const cleanUninstall = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "uninstall"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(cleanUninstall.status, cleanUninstall.stderr).toBe(0);
    expect(readFileSync(configPath, "utf8")).not.toContain("workspacejson-codex-mcp PreToolUse hook");
  });

  it("refuses to overwrite or remove unmanaged same-name configuration", () => {
    const target = mkdtempSync(resolve(tmpdir(), "wjson-collision-"));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");
    const codexDir = resolve(target, ".codex");
    mkdirSync(codexDir, { recursive: true });
    const configPath = resolve(codexDir, "config.toml");
    const original = '[mcp_servers.workspacejson]\ncommand = "custom"\n';
    writeFileSync(configPath, original);

    const install = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "install", "--with-hook"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(install.status).toBe(1);
    expect(install.stderr).toContain("Refusing to overwrite unmanaged");
    expect(readFileSync(configPath, "utf8")).toBe(original);

    const uninstall = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "uninstall"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);
    expect(readFileSync(configPath, "utf8")).toContain('command = "custom"');
  });

  it("refuses to overwrite or remove an unmanaged runtime directory", () => {
    const target = mkdtempSync(resolve(tmpdir(), "wjson-runtime-collision-"));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");
    const runtime = resolve(target, ".codex/workspacejson-codex-mcp");
    mkdirSync(runtime, { recursive: true });
    writeFileSync(resolve(runtime, "keep.txt"), "user data\n");

    const install = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "install", "--with-hook"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(install.status).toBe(1);
    expect(install.stderr).toContain("Refusing to overwrite unmanaged runtime directory");

    const uninstall = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "uninstall"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);
    expect(readFileSync(resolve(runtime, "keep.txt"), "utf8")).toBe("user data\n");
  });

  it("preserves indented unrelated TOML sections and private config permissions", () => {
    const target = mkdtempSync(resolve(tmpdir(), "wjson-preserve-"));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");
    const codexDir = resolve(target, ".codex");
    mkdirSync(codexDir, { recursive: true });
    const configPath = resolve(codexDir, "config.toml");
    writeFileSync(
      configPath,
      '[mcp_servers.workspacejson]\n# workspacejson-codex-mcp managed MCP block\ncommand = "old"\n  [unrelated.private]\ntoken = "preserve-me"\n',
    );
    chmodSync(configPath, 0o600);

    const install = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "install"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(install.status, install.stderr).toBe(0);
    expect(readFileSync(configPath, "utf8")).toContain('  [unrelated.private]\ntoken = "preserve-me"');
    expect(statSync(configPath).mode & 0o777).toBe(0o600);

    const uninstall = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "uninstall"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(uninstall.status, uninstall.stderr).toBe(0);
    expect(readFileSync(configPath, "utf8")).toContain('  [unrelated.private]\ntoken = "preserve-me"');
    expect(statSync(configPath).mode & 0o777).toBe(0o600);
  });
});
