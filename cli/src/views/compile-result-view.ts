import type { View } from "@framework/types.js";

/** What a finished compile reports: a full count, or one alias's outcome. */
type CompileOutcome = { compiled: number } | { alias: string; warnings: string[] };

/**
 * What a finished compile reports: the up-to-date count for a full
 * compile, or one alias's warnings and confirmation.
 */
const compileResultView: View<CompileOutcome> = (outcome) => {
  if ("compiled" in outcome) {
    return [{ channel: "heading", text: `Compiled ${outcome.compiled} agent(s) (up-to-date)` }];
  }

  return [
    ...outcome.warnings.map((text) => ({ channel: "warning" as const, text })),
    { channel: "success", text: `Compiled ${outcome.alias.toLowerCase()}.md` },
  ];
};

export default compileResultView;
