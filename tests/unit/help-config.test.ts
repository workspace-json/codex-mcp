import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Re-review finding #4: the `--help` output in src/index.ts printed the exact
 * pre-HAC-128 broken config (`args` without `server`). Copy-pasting it relaunches
 * the installer instead of the server. The example must include `server`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(resolve(here, "../../src/index.ts"), "utf8");

describe("src/index.ts --help example config", () => {
  it("shows an args line that launches the server", () => {
    const match = indexSrc.match(/args = \[([^\]]*)\]/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain("server");
  });
});
