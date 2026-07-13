/**
 * Verify-mode gate (HAC-111).
 *
 * VERIFIED is an OPT-IN, CI/CLI-time tier: it re-runs a recorded read-only git
 * command to confirm the evidence still reproduces. That is deliberately kept
 * OFF the Codex hook hot path — re-running git on every proposed edit would be a
 * latency machine (R-V3). Enable it explicitly with the `--verify` CLI flag or
 * `WJSON_VERIFY=1` in the environment (e.g. the MCP server's env block). Off by
 * default everywhere.
 */
export function isVerifyEnabled(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): boolean {
  return env.WJSON_VERIFY === "1" || argv.includes("--verify");
}
