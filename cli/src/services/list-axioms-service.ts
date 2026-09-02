import type { ListAxiomsInput, ListAxiomsResult } from "@/types.js";

import { exists, listFilesRecursive } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { AxiomFile } from "@/models/axiom-file.js";

/**
 * Every axiom in the project's store — active, deprecated, and proposed
 * (`.praxis/axioms/` and its `proposed/` subdirectory).
 *
 * One malformed file never takes down the sweep: it is reported in
 * `problems` and the rest of the store still loads. Sorted by
 * `introduced` date with id as tiebreak — random ids carry no order,
 * the frontmatter does.
 */
export default function listAxiomsService({ root }: ListAxiomsInput): ListAxiomsResult {
  const axiomsDir = joinPath(root, ".praxis", "axioms");

  if (!exists(axiomsDir)) return { axioms: [], problems: [] };

  const axioms: AxiomFile[] = [];
  const problems: ListAxiomsResult["problems"] = [];

  for (const file of listFilesRecursive(axiomsDir)) {
    if (!file.endsWith(".md")) continue;

    const path = joinPath(axiomsDir, file);

    try {
      axioms.push(AxiomFile.at(path));
    } catch (err) {
      problems.push({ path, message: err instanceof Error ? err.message : String(err) });
    }
  }

  axioms.sort((a, b) => byIntroducedThenId(a, b));

  return { axioms, problems };
}

/** Chronological order, ids breaking ties so equal dates stay stable. */
function byIntroducedThenId(a: AxiomFile, b: AxiomFile): number {
  if (a.introduced !== b.introduced) return a.introduced < b.introduced ? -1 : 1;

  return a.id.localeCompare(b.id);
}
