import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const OPENAI_REVIEWER_MODEL = "gpt-5.6";
export const OPENROUTER_REVIEWER_MODEL = "openai/gpt-5.6-terra";
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/responses";

export type ReviewerVerdict = "PASS" | "BLOCK";
export type ReviewerResult =
  | { status: "UNAVAILABLE"; reason: string; artifactDir?: string }
  | {
      status: "COMPLETED";
      artifactDir: string;
      verdict: ReviewerVerdict;
      findings: string[];
      evidence: string[];
      checked: string[];
      gaps: string[];
    };

type Fetch = typeof fetch;
type ReviewerTransport = {
  apiKey: string;
  endpoint: string;
  model: string;
  provider: "openai" | "openrouter";
};
type ReviewerProvider = ReviewerTransport["provider"];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "findings", "evidence", "checked", "gaps"],
  properties: {
    verdict: { type: "string", enum: ["PASS", "BLOCK"] },
    findings: { type: "array", items: { type: "string" } },
    evidence: { type: "array", items: { type: "string" } },
    checked: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
  },
};

function artifactDirectory(cwd: string, supplied?: string): string {
  return resolve(cwd, supplied ?? ".local/workspacejson/reviewer", new Date().toISOString().replaceAll(":", "-"));
}

function extractOutputText(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;
  if (typeof (response as { output_text?: unknown }).output_text === "string")
    return (response as { output_text: string }).output_text;
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;
  for (const item of output) {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) continue;
    for (const content of (item as { content: unknown[] }).content) {
      if (content && typeof content === "object" && typeof (content as { text?: unknown }).text === "string")
        return (content as { text: string }).text;
    }
  }
  return undefined;
}

function parseVerdict(
  text: string,
): Omit<Extract<ReviewerResult, { status: "COMPLETED" }>, "status" | "artifactDir"> | undefined {
  try {
    const value = JSON.parse(text) as Partial<Extract<ReviewerResult, { status: "COMPLETED" }>>;
    if (value.verdict !== "PASS" && value.verdict !== "BLOCK") return undefined;
    const arrays = [value.findings, value.evidence, value.checked, value.gaps];
    if (!arrays.every((items) => Array.isArray(items) && items.every((entry) => typeof entry === "string")))
      return undefined;
    const [findings, evidence, checked, gaps] = arrays as string[][];
    return { verdict: value.verdict, findings, evidence, checked, gaps };
  } catch {
    return undefined;
  }
}

export async function reviewDiff(options: {
  diff: string;
  cwd?: string;
  evidenceDir?: string;
  apiKey?: string;
  openRouterApiKey?: string;
  openRouterEndpoint?: string;
  model?: string;
  provider?: ReviewerProvider;
  fetchFn?: Fetch;
}): Promise<ReviewerResult> {
  const transport = resolveTransport(options);
  if (!transport)
    return {
      status: "UNAVAILABLE",
      reason: unavailableReason(options),
    };

  const cwd = options.cwd ?? process.cwd();
  const dir = artifactDirectory(cwd, options.evidenceDir);
  const request = {
    model: transport.model,
    store: false,
    reasoning: { effort: "high" },
    instructions:
      "You are the workspace.json advisory reviewer. Review only the supplied proposed diff. You are read-only and have no enforcement authority. Return a concise JSON object. PASS means no blocking issue was found in this scope, never a safety certification. Missing evidence is a gap, never approval.",
    input: `Proposed diff:\n\n${options.diff}`,
    text: { format: { type: "json_schema", name: "workspacejson_reviewer_verdict", strict: true, schema } },
  };

  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "request.json"), `${JSON.stringify(request, null, 2)}\n`);
  await writeFile(
    resolve(dir, "receipt.json"),
    `${JSON.stringify({ provider: transport.provider, endpoint: transport.endpoint, model: transport.model }, null, 2)}\n`,
  );
  const fetchFn = options.fetchFn ?? fetch;
  let rawResponse: unknown;
  try {
    const response = await fetchFn(transport.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${transport.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const responseBody = await response.text();
    await writeFile(resolve(dir, "response.json"), responseBody);
    try {
      rawResponse = JSON.parse(responseBody);
    } catch {
      return {
        status: "UNAVAILABLE",
        reason: "Reviewer response was malformed; deterministic enforcement remains active.",
        artifactDir: dir,
      };
    }
    if (!response.ok)
      return { status: "UNAVAILABLE", reason: `Reviewer API returned HTTP ${response.status}.`, artifactDir: dir };
  } catch (error) {
    rawResponse = { error: error instanceof Error ? error.message : String(error) };
    await writeFile(resolve(dir, "response.json"), `${JSON.stringify(rawResponse, null, 2)}\n`);
    return {
      status: "UNAVAILABLE",
      reason: "Reviewer API request failed; deterministic enforcement remains active.",
      artifactDir: dir,
    };
  }

  const verdict = parseVerdict(extractOutputText(rawResponse) ?? "");
  if (!verdict)
    return {
      status: "UNAVAILABLE",
      reason: "Reviewer response was malformed; deterministic enforcement remains active.",
      artifactDir: dir,
    };
  const result: ReviewerResult = { status: "COMPLETED", artifactDir: dir, ...verdict };
  await writeFile(resolve(dir, "verdict.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function resolveTransport(options: {
  apiKey?: string;
  openRouterApiKey?: string;
  openRouterEndpoint?: string;
  model?: string;
  provider?: ReviewerProvider;
}): ReviewerTransport | undefined {
  const configuredProvider = options.provider ?? process.env.WORKSPACEJSON_REVIEWER_PROVIDER;
  const openRouterApiKey = options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY;
  const openAiApiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const useOpenRouter =
    configuredProvider === "openrouter" ||
    (!!options.openRouterApiKey && !options.apiKey) ||
    (!configuredProvider && !!process.env.WORKSPACEJSON_REVIEWER_BASE_URL && !options.apiKey);
  const useOpenAi = configuredProvider === "openai" || (!!options.apiKey && !options.openRouterApiKey);

  if (useOpenRouter && openRouterApiKey)
    return {
      provider: "openrouter",
      apiKey: openRouterApiKey,
      endpoint: options.openRouterEndpoint ?? process.env.WORKSPACEJSON_REVIEWER_BASE_URL ?? OPENROUTER_API_URL,
      model: options.model ?? process.env.WORKSPACEJSON_REVIEWER_MODEL ?? OPENROUTER_REVIEWER_MODEL,
    };

  if (useOpenAi && openAiApiKey)
    return {
      provider: "openai",
      apiKey: openAiApiKey,
      endpoint: OPENAI_API_URL,
      model: options.model ?? process.env.WORKSPACEJSON_REVIEWER_MODEL ?? OPENAI_REVIEWER_MODEL,
    };

  if (!configuredProvider && !options.apiKey && !options.openRouterApiKey && openRouterApiKey && !openAiApiKey)
    return {
      provider: "openrouter",
      apiKey: openRouterApiKey,
      endpoint: process.env.WORKSPACEJSON_REVIEWER_BASE_URL ?? OPENROUTER_API_URL,
      model: options.model ?? process.env.WORKSPACEJSON_REVIEWER_MODEL ?? OPENROUTER_REVIEWER_MODEL,
    };
  if (!configuredProvider && !options.apiKey && !options.openRouterApiKey && openAiApiKey && !openRouterApiKey)
    return {
      provider: "openai",
      apiKey: openAiApiKey,
      endpoint: OPENAI_API_URL,
      model: options.model ?? process.env.WORKSPACEJSON_REVIEWER_MODEL ?? OPENAI_REVIEWER_MODEL,
    };
  return undefined;
}

function unavailableReason(options: {
  apiKey?: string;
  openRouterApiKey?: string;
  provider?: ReviewerProvider;
}): string {
  const configuredProvider = options.provider ?? process.env.WORKSPACEJSON_REVIEWER_PROVIDER;
  if (configuredProvider && configuredProvider !== "openai" && configuredProvider !== "openrouter")
    return "WORKSPACEJSON_REVIEWER_PROVIDER must be openai or openrouter; deterministic enforcement remains active.";
  if (
    !options.apiKey &&
    !options.openRouterApiKey &&
    process.env.OPENAI_API_KEY &&
    process.env.OPENROUTER_API_KEY &&
    !configuredProvider
  )
    return "Both reviewer keys are set; configure WORKSPACEJSON_REVIEWER_PROVIDER as openai or openrouter; deterministic enforcement remains active.";
  return "No reviewer API key is set (OPENAI_API_KEY or OPENROUTER_API_KEY); deterministic enforcement remains active.";
}

export function formatReviewerResult(result: ReviewerResult): string {
  if (result.status === "UNAVAILABLE")
    return `REVIEWER: UNAVAILABLE\nREASON: ${result.reason}${result.artifactDir ? `\nARTIFACT: ${result.artifactDir}` : ""}`;
  return [
    `VERDICT: ${result.verdict}`,
    `FINDINGS:\n${result.findings.join("\n") || "None."}`,
    `EVIDENCE:\n${result.evidence.join("\n") || "None."}`,
    `WHAT I CHECKED AND DID NOT:\n${[...result.checked, ...result.gaps.map((gap) => `GAP: ${gap}`)].join("\n") || "None."}`,
    `ARTIFACT: ${result.artifactDir}`,
  ].join("\n\n");
}

async function readStdin(): Promise<string> {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

export async function runReviewerCli(args: string[]): Promise<number> {
  let stdin = false;
  let diffFile: string | undefined;
  let evidenceDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--diff-stdin" && !stdin) {
      stdin = true;
      continue;
    }
    if (
      (argument === "--diff-file" || argument === "--evidence-dir") &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    ) {
      const value = args[index + 1];
      if (argument === "--diff-file" && !diffFile) diffFile = value;
      else if (argument === "--evidence-dir" && !evidenceDir) evidenceDir = value;
      else return usage();
      index += 1;
      continue;
    }
    return usage();
  }
  if ((stdin && diffFile) || (!stdin && !diffFile)) {
    return usage();
  }
  const diff = stdin ? await readStdin() : await readFile(resolve(process.cwd(), diffFile ?? ""), "utf8");
  const result = await reviewDiff({ diff, evidenceDir });
  console.log(formatReviewerResult(result));
  return 0;
}

function usage(): number {
  console.error("Usage: workspacejson-codex-mcp review (--diff-stdin | --diff-file <path>) [--evidence-dir <path>]");
  return 1;
}
