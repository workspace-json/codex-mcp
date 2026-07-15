import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatReviewerResult, reviewDiff, runReviewerCli } from "../../src/reviewer.js";

const created: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const path of created.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("direct advisory reviewer", () => {
  it("is explicitly unavailable without an API key and does not call the network", async () => {
    const fetchFn = vi.fn();
    await expect(
      reviewDiff({ diff: "diff --git a/a b/a", apiKey: "", fetchFn: fetchFn as typeof fetch }),
    ).resolves.toEqual({
      status: "UNAVAILABLE",
      reason:
        "No reviewer API key is set (OPENAI_API_KEY or OPENROUTER_API_KEY); deterministic enforcement remains active.",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("preserves a redacted-key request, raw response, and normalized advisory verdict", async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), "wjson-review-"));
    created.push(cwd);
    const raw = {
      model: "gpt-5.6",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                verdict: "BLOCK",
                findings: ["src/a.ts:1 needs its recorded partner"],
                evidence: ["recorded claim"],
                checked: ["proposed diff"],
                gaps: ["tests were not run"],
              }),
            },
          ],
        },
      ],
    };
    const result = await reviewDiff({
      diff: "diff --git a/src/a.ts b/src/a.ts",
      cwd,
      evidenceDir: "receipt",
      apiKey: "test-key",
      fetchFn: vi.fn(async () => new Response(JSON.stringify(raw), { status: 200 })) as unknown as typeof fetch,
    });

    expect(result.status).toBe("COMPLETED");
    if (result.status !== "COMPLETED") return;
    expect(result.verdict).toBe("BLOCK");
    expect(existsSync(resolve(result.artifactDir, "request.json"))).toBe(true);
    expect(existsSync(resolve(result.artifactDir, "response.json"))).toBe(true);
    expect(existsSync(resolve(result.artifactDir, "verdict.json"))).toBe(true);
    expect(readFileSync(resolve(result.artifactDir, "request.json"), "utf8")).not.toContain("test-key");
    expect(formatReviewerResult(result)).toContain("VERDICT: BLOCK");
  });

  it("makes malformed model output explicitly unavailable while retaining the raw response", async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), "wjson-review-"));
    created.push(cwd);
    const result = await reviewDiff({
      diff: "diff --git a/a b/a",
      cwd,
      apiKey: "test-key",
      fetchFn: vi.fn(
        async () => new Response(JSON.stringify({ output_text: "not json" }), { status: 200 }),
      ) as unknown as typeof fetch,
    });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reason).toContain("malformed");
    if (!result.artifactDir) throw new Error("missing malformed-response artifact");
    expect(existsSync(resolve(result.artifactDir, "response.json"))).toBe(true);
  });

  it("uses explicit OpenRouter transport settings and records the provider", async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), "wjson-review-"));
    created.push(cwd);
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({ verdict: "PASS", findings: [], evidence: [], checked: ["diff"], gaps: [] }),
          }),
          { status: 200 },
        ),
    );
    const result = await reviewDiff({
      diff: "diff --git a/a b/a",
      cwd,
      openRouterApiKey: "router-key",
      openRouterEndpoint: "https://router.example/responses",
      model: "openai/gpt-5.6-terra",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.status).toBe("COMPLETED");
    if (!result.artifactDir) throw new Error("missing receipt artifact");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://router.example/responses",
      expect.objectContaining({ method: "POST" }),
    );
    expect(readFileSync(resolve(result.artifactDir, "receipt.json"), "utf8")).toContain('"provider": "openrouter"');
    expect(readFileSync(resolve(result.artifactDir, "request.json"), "utf8")).toContain(
      '"model": "openai/gpt-5.6-terra"',
    );
  });

  it("gives an explicit OpenAI credential precedence over an ambient OpenRouter credential", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "ambient-router-key");
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({ verdict: "PASS", findings: [], evidence: [], checked: ["diff"], gaps: [] }),
          }),
          { status: 200 },
        ),
    );
    await reviewDiff({ diff: "diff --git a/a b/a", apiKey: "explicit-openai-key", fetchFn: fetchFn as typeof fetch });
    expect(fetchFn).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.any(Object));
  });

  it("rejects ambiguous or incomplete diff input arguments", async () => {
    await expect(runReviewerCli(["--diff-stdin", "--diff-file"])).resolves.toBe(1);
    await expect(runReviewerCli(["--diff-file"])).resolves.toBe(1);
    await expect(runReviewerCli(["--diff-stdin", "--evidence-dir"])).resolves.toBe(1);
    await expect(runReviewerCli(["--diff-stdin", "--unexpected"])).resolves.toBe(1);
  });
});
