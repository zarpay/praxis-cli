import type { CompileOutcome } from "@/types.js";
import type { View } from "@framework/types.js";

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
