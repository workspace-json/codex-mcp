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

  it("dispatches on positional command only, so a flag value named 'server' cannot hijack install into runServer", () => {
    const target = mkdtempSync(resolve(tmpdir(), "wjson-install-dispatch-"));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");
    const codexDir = resolve(target, ".codex");
    mkdirSync(codexDir, { recursive: true });
    const configPath = resolve(codexDir, "config.toml");

    // --vsix takes an arbitrary path argument; "server" is a plausible value
    // and must not be mistaken for the `server` subcommand. A 10s timeout
    // guards against the pre-fix behavior, which hangs on runServer()'s stdio
    // server instead of exiting.
    const result = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "install", "--vsix", "server"], {
      cwd: target,
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(result.signal, result.stderr).toBeNull();
    expect(result.status, result.stderr).toBe(0);
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain("[mcp_servers.workspacejson]");
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

  it("installs the MCP block in a fresh repo that has no .codex directory yet", () => {
    // Regression: bare `install` (no --with-hook) must create .codex/ itself.
    // A fresh consumer repo has none, and only --with-hook used to create it.
    const target = mkdtempSync(resolve(tmpdir(), "wjson-fresh-"));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");

    const install = spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), "install"], {
      cwd: target,
      encoding: "utf8",
    });
    expect(install.status, install.stderr).toBe(0);
    const config = readFileSync(resolve(target, ".codex/config.toml"), "utf8");
    expect(config).toContain("[mcp_servers.workspacejson]");
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

// A minimal fake VS Code `code` CLI: version, list, install, uninstall against a
// newline-delimited "id@version" state file. Lets the extension paths be tested
// deterministically with no real editor present.
const FAKE_CODE = `#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const stateFile = process.env.CODE_FAKE_STATE;
const args = process.argv.slice(2);
const load = () => (existsSync(stateFile) ? readFileSync(stateFile, "utf8").split("\\n").filter(Boolean) : []);
const save = (l) => writeFileSync(stateFile, l.join("\\n") + (l.length ? "\\n" : ""));
if (args[0] === "--version") { process.stdout.write("1.95.0\\nabc123\\nx64\\n"); process.exit(0); }
if (args.includes("--list-extensions")) {
  const sv = args.includes("--show-versions");
  const l = load();
  process.stdout.write(l.map((e) => (sv ? e : e.split("@")[0])).join("\\n") + (l.length ? "\\n" : ""));
  process.exit(0);
}
const i = args.indexOf("--install-extension");
if (i !== -1) {
  const base = args[i + 1].split("/").pop();
  const m = base.match(/^(.*)-([0-9][^-]*)\\.vsix$/);
  const id = m ? "workspace-json." + m[1] : args[i + 1];
  const ver = m ? m[2] : "9.9.9";
  const l = load().filter((e) => e.split("@")[0].toLowerCase() !== id.toLowerCase());
  l.push(id + "@" + ver);
  save(l);
  process.stdout.write("installed\\n");
  process.exit(0);
}
const u = args.indexOf("--uninstall-extension");
if (u !== -1) {
  const id = args[u + 1];
  const before = load();
  const after = before.filter((e) => e.split("@")[0].toLowerCase() !== id.toLowerCase());
  if (after.length === before.length) { process.stderr.write("not installed\\n"); process.exit(1); }
  save(after);
  process.exit(0);
}
process.exit(1);
`;

const EXT_ID = "workspace-json.workspacejson-codex-decorations";

describe("extension distribution (--with-extension)", () => {
  function scaffold(prefix: string) {
    const target = mkdtempSync(resolve(tmpdir(), prefix));
    created.push(target);
    writeFileSync(resolve(target, "package.json"), "{}\n");
    const shim = resolve(target, "fake-code.mjs");
    writeFileSync(shim, FAKE_CODE);
    chmodSync(shim, 0o755);
    const state = resolve(target, "code-state.txt");
    const vsix = resolve(target, "workspacejson-codex-decorations-0.0.1.vsix");
    writeFileSync(vsix, "");
    return { target, shim, state, vsix };
  }
  const run = (target: string, args: string[], env: Record<string, string>) =>
    spawnSync("node", [resolve(process.cwd(), "scripts/install.mjs"), ...args], {
      cwd: target,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });

  it("reports UNAVAILABLE and leaves the core install intact when no code CLI exists", () => {
    const { target } = scaffold("wjson-ext-unavail-");
    const r = run(target, ["install", "--with-extension"], { WORKSPACEJSON_CODE_CLI: "/nonexistent/code" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("UNAVAILABLE");
    expect(existsSync(resolve(target, ".codex/config.toml"))).toBe(true);
  });

  it("installs idempotently and reports ALREADY_INSTALLED on a second run", () => {
    const { target, shim, state, vsix } = scaffold("wjson-ext-idem-");
    const env = { WORKSPACEJSON_CODE_CLI: shim, CODE_FAKE_STATE: state };
    const first = run(target, ["install", "--with-extension", "--vsix", vsix], env);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("PASS");
    expect(readFileSync(state, "utf8")).toContain(`${EXT_ID}@0.0.1`);
    const second = run(target, ["install", "--with-extension", "--vsix", vsix], env);
    expect(second.stdout).toContain("ALREADY_INSTALLED");
  });

  it("bare uninstall preserves the global extension; --with-extension removes only the owned id", () => {
    const { target, shim, state, vsix } = scaffold("wjson-ext-remove-");
    const env = { WORKSPACEJSON_CODE_CLI: shim, CODE_FAKE_STATE: state };
    writeFileSync(state, "some.other-ext@1.2.3\n");
    run(target, ["install", "--with-extension", "--vsix", vsix], env);
    expect(readFileSync(state, "utf8")).toContain(EXT_ID);

    run(target, ["uninstall"], env);
    expect(readFileSync(state, "utf8")).toContain(EXT_ID); // preserved without consent

    run(target, ["uninstall", "--with-extension"], env);
    const finalState = readFileSync(state, "utf8");
    expect(finalState).not.toContain(EXT_ID); // owned id removed
    expect(finalState).toContain("some.other-ext@1.2.3"); // unrelated preserved
  });

  it("refuses an artifact whose filename is not the owned extension", () => {
    const { target, shim, state } = scaffold("wjson-ext-artifact-");
    const bogus = resolve(target, "totally-unrelated.vsix");
    writeFileSync(bogus, "");
    const r = run(target, ["install", "--with-extension", "--vsix", bogus], {
      WORKSPACEJSON_CODE_CLI: shim,
      CODE_FAKE_STATE: state,
    });
    expect(r.stdout).toContain("FAILED");
    expect(r.stdout).toContain("Refusing to install unrecognized artifact");
    expect(existsSync(state)).toBe(false); // nothing installed
  });
});
