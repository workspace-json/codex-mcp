import assert from "node:assert/strict";
import test from "node:test";
import { retrySummary } from "../src/bootstrap.ts";

test("a retry combines the registered identity and display policies", () => {
  assert.equal(retrySummary(1250), "member retry: $12.50");
});
