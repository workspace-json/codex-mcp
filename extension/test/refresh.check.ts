import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshVerdict } from "../src/verdictRefresh.js";

test("verdict refresh stores the result and emits one intelligence refresh event", async () => {
  let stored: unknown;
  let refreshes = 0;
  const verdict = {
    status: "COMPLETED" as const,
    verdict: "PASS" as const,
    artifactDir: "/tmp/reviewer",
    findings: [],
    evidence: [],
    checked: [],
    gaps: [],
  };

  await refreshVerdict(
    "/tmp/workspacejson-refresh-test",
    async () => verdict,
    (value) => { stored = value; },
    () => { refreshes++; },
    () => undefined,
  );

  assert.deepEqual(stored, verdict);
  assert.equal(refreshes, 1);
});

test("verdict refresh falls back to the onError value and still emits exactly once", async () => {
  let stored: unknown = "unset";
  let refreshes = 0;
  await refreshVerdict(
    "/tmp/workspacejson-refresh-test",
    async () => {
      throw new Error("discovery blew up");
    },
    (value) => { stored = value; },
    () => { refreshes++; },
    () => "fallback",
  );
  assert.equal(stored, "fallback");
  assert.equal(refreshes, 1);
});
