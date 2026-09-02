import fg from "fast-glob";

import { ExpertFile } from "@/models/expert-file.js";

/**
 * The expert file declaring an alias, or null when none does.
 *
 * Matches case-insensitively, because an alias is a name a person
 * types. A malformed neighbour is skipped rather than raised on:
 * compiling it is what should surface its error, with the full message,
 * not a search that happened to walk past it.
 */
export default async function findExpertByAlias({
  alias,
  expertsDir,
}: {
  alias: string;
  expertsDir: string;
}): Promise<string | null> {
  const expertFiles = await fg("*.md", { cwd: expertsDir, onlyFiles: true, absolute: true });

  for (const expertFile of expertFiles) {
    if (readAlias(expertFile)?.toLowerCase() === alias.toLowerCase()) {
      return expertFile;
    }
  }

  return null;
}

/** An expert's alias, or null when the file cannot be read as an expert. */
function readAlias(expertFile: string): string | null {
  try {
    return ExpertFile.at(expertFile).alias;
  } catch {
    return null;
  }
}
