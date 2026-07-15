/**
 * The complete allowlist of command ids this extension contributes. Rich
 * Markdown tooltips (§4.3) set `isTrusted.enabledCommands` to exactly this
 * set — never `isTrusted: true` globally — so a tooltip can only invoke these
 * vetted commands and nothing else.
 */
export const COMMAND_IDS = {
  openFile: "workspacejson.openFile",
  inspectEvidence: "workspacejson.inspectEvidence",
  runVerification: "workspacejson.runVerification",
  runReview: "workspacejson.runReview",
  inspectReceipt: "workspacejson.inspectReceipt",
  focusCurrentChange: "workspacejson.focusCurrentChange",
  openIntelligenceFile: "workspacejson.openIntelligenceFile",
} as const;

/** Exactly the ids permitted inside a trusted MarkdownString tooltip (§4.3). */
export const TRUSTED_TOOLTIP_COMMANDS: readonly string[] = [
  COMMAND_IDS.openFile,
  COMMAND_IDS.inspectEvidence,
  COMMAND_IDS.runVerification,
  COMMAND_IDS.runReview,
  COMMAND_IDS.inspectReceipt,
  COMMAND_IDS.focusCurrentChange,
];
