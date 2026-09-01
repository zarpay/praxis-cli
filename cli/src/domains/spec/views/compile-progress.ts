import type { CompileProgress } from "@/domains/spec/types.js";
import type { ReportLine } from "@/types.js";

/**
 * One compile event as it happens.
 *
 * Everything a compile says goes to stderr: the command's stdout is the
 * compiled files themselves, so progress must not pollute it.
 */
export function compileProgressLine(event: CompileProgress): ReportLine {
  if (event.kind === "compiled") {
    return { channel: "success", text: `Compiled ${event.alias.toLowerCase()}.md` };
  }

  if (event.kind === "skipped") {
    return { channel: "warning", text: `Skipping ${event.file}: ${event.reason}` };
  }

  return { channel: "warning", text: event.message };
}

/** What a finished compile reports. */
export function compiledCount(compiled: number): ReportLine {
  return { channel: "heading", text: `Compiled ${compiled} agent(s) (up-to-date)` };
}

/** One expert compiled by alias: its warnings, then the confirmation. */
export function compiledOneLines(alias: string, warnings: string[]): ReportLine[] {
  return [
    ...warnings.map((text) => ({ channel: "warning" as const, text })),
    { channel: "success", text: `Compiled ${alias.toLowerCase()}.md` },
  ];
}

/** What a watch session says as it starts and as it reacts. */
export function watchingLine(sourceDir: string): ReportLine {
  return { channel: "heading", text: `Watching ${sourceDir} for changes...` };
}

/** The line announcing a recompile, naming the file when the watcher knew it. */
export function recompilingLine(filename: string | null): ReportLine {
  return {
    channel: "heading",
    text: `Change detected${filename ? `: ${filename}` : ""}, recompiling...`,
  };
}
