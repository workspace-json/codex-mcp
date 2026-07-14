import { describe, expect, it } from "vitest";
import { isVerifyEnabled } from "../../src/config.js";

/**
 * HAC-111 R-V1: VERIFIED is an opt-in tier. `--verify` (CLI) or WJSON_VERIFY=1
 * (env) turns it on; it is OFF by default everywhere.
 */

describe("isVerifyEnabled", () => {
  it("is off by default (no env, no flag)", () => {
    expect(isVerifyEnabled({}, ["node", "script"])).toBe(false);
  });

  it("is on when WJSON_VERIFY=1", () => {
    expect(isVerifyEnabled({ WJSON_VERIFY: "1" }, ["node", "script"])).toBe(true);
  });

  it("is off for any WJSON_VERIFY value other than exactly '1'", () => {
    expect(isVerifyEnabled({ WJSON_VERIFY: "0" }, [])).toBe(false);
    expect(isVerifyEnabled({ WJSON_VERIFY: "true" }, [])).toBe(false);
  });

  it("is on when --verify is present in argv", () => {
    expect(isVerifyEnabled({}, ["node", "hook", "--paths", "a.ts", "--verify"])).toBe(true);
  });
});
