import type { CompileProgress } from "@/types.js";
import type { View } from "@framework/types.js";

/**
 * One compile event as it happens.
 *
 * Everything a compile says goes to stderr: the command's stdout is the
 * compiled files themselves, so progress must not pollute it.
 */
const compileProgressView: View<CompileProgress> = (event) => {
  if (event.kind === "compiled") {
    return [{ channel: "success", text: `Compiled ${event.alias.toLowerCase()}.md` }];
  }

  if (event.kind === "skipped") {
    return [{ channel: "warning", text: `Skipping ${event.file}: ${event.reason}` }];
  }

  return [{ channel: "warning", text: event.message }];
};

export default compileProgressView;
