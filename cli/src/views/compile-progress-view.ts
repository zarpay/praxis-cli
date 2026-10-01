import type { CompileProgress } from "@/types.js";
import type { View } from "@framework/types.js";

import { compiledLine } from "@/views/compile-result-view.js";

/**
 * One compile event as it happens.
 *
 * Everything a compile says goes to stderr: the command's stdout is the
 * compiled files themselves, so progress must not pollute it.
 */
const compileProgressView: View<CompileProgress> = (event) => {
  if (event.kind === "compiled") {
    return [{ channel: "success", text: compiledLine(event.alias, event.output) }];
  }

  if (event.kind === "skipped") {
    return [{ channel: "warning", text: `Skipping ${event.file}: ${event.reason}` }];
  }

  return [{ channel: "warning", text: event.message }];
};

export default compileProgressView;
