import type { View } from "@framework/types.js";

/** What a finished compile reports: a full count, or one alias's outcome. */
type CompileOutcome =
  { compiled: number } | { alias: string; output: string | null; warnings: string[] };

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
    { channel: "success", text: compiledLine(outcome.alias, outcome.output) },
  ];
};

export default compileResultView;

/**
 * The confirmation for one compiled expert: the path that was actually
 * written, never a filename guessed from the alias. With no profile
 * directory configured nothing but plugin output exists, and the line
 * says so rather than naming a file that is not there.
 */
export function compiledLine(alias: string, output: string | null): string {
  return output === null ? `Compiled ${alias} (plugin output only)` : `Compiled ${output}`;
}
