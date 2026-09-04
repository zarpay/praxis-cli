import type { RefKey, StatusReport } from "@/types.js";
import type { Service } from "@/types.js";

import { exists, readText } from "@/helpers/files-helper.js";
import { baseName, joinPath } from "@/helpers/paths-helper.js";
import { ExpertFile } from "@/models/expert-file.js";
import expandGlobsService from "@/services/expand-globs-service.js";

/**
 * What one pass over the expert files found.
 *
 * Every field answers a different structural question, but they share
 * a parse, which is why the audit produces them together.
 */
interface ExpertAudit {
  /** Lowercased alias to the expert file that declares it. */
  aliases: Map<string, string>;
  /** Project-relative practice paths some expert points at. */
  referencedPractices: Set<string>;
  /** Experts that could not be read, with the reason. */
  invalidExperts: StatusReport["invalidExperts"];
  /** References to files that do not exist. */
  danglingRefs: StatusReport["danglingRefs"];
  /** Glob patterns matching nothing. */
  zeroMatchGlobs: StatusReport["zeroMatchGlobs"];
  /** Experts with no description, by filename. */
  missingDescriptions: string[];
}

/** The experts to audit. */
interface AuditExpertsInput {
  /** Absolute paths to the expert files. */
  expertFiles: string[];
}

/** The reference keys an expert can point at other documents with. */
const REF_KEYS: readonly RefKey[] = ["practices", "context", "refs"];

/**
 * Checks the cross-references between experts and what they point at.
 *
 * One pass answers every structural question at once — which aliases
 * exist, which practices are actually referenced, which references
 * dangle, which globs match nothing — because each answer needs the
 * same parse of the same files.
 *
 * An expert that fails to parse is recorded, never raised: project
 * health is exactly the report you want when a document is broken.
 */
const auditExpertsService: Service<AuditExpertsInput, Promise<ExpertAudit>> = async (
  cfg,
  { expertFiles },
) => {
  const audit: ExpertAudit = {
    aliases: new Map<string, string>(),
    referencedPractices: new Set<string>(),
    invalidExperts: [],
    danglingRefs: [],
    zeroMatchGlobs: [],
    missingDescriptions: [],
  };

  for (const expertFile of expertFiles) {
    const expert = baseName(expertFile);
    let parsed: ExpertFile;

    try {
      parsed = ExpertFile.fromContent(readText(expertFile), expertFile);
    } catch (err) {
      audit.invalidExperts.push({
        expert,
        reason: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    audit.aliases.set(parsed.alias.toLowerCase(), expert);

    if (!parsed.description) {
      audit.missingDescriptions.push(expert);
    }

    for (const key of REF_KEYS) {
      const expansions = await expandGlobsService(cfg, { patterns: parsed.refs(key) });

      for (const { pattern, isGlob, matches } of expansions) {
        // A glob matching nothing is a typo; a plain path that does not
        // exist is a dangling reference. The distinction is what makes
        // each finding actionable.
        if (isGlob && matches.length === 0) {
          audit.zeroMatchGlobs.push({ expert, pattern });
        }

        if (!isGlob && !exists(joinPath(cfg.root, pattern))) {
          audit.danglingRefs.push({ expert, ref: pattern });
        }

        if (key === "practices") {
          for (const match of matches) audit.referencedPractices.add(match);
        }
      }
    }
  }

  return audit;
};

export default auditExpertsService;
