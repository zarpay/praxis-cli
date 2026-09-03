import type { DerivePopulationInput, PopulationQualifier, Service } from "@/types.js";

import { fileFirstCommitDate } from "@/helpers/git-helper.js";

/**
 * A file's population relative to one axiom (01, 04): pre-spec when the
 * file predates the axiom's `introduced` date, post-spec otherwise,
 * unknown wherever git cannot answer — never guessed.
 *
 * Population clocks are per-axiom (01 open q1, resolved in 02): the
 * same file can be pre-spec debt for one axiom and post-spec signal for
 * a newer one. Derived read-side from provenance; the stored record's
 * "unknown" is a convenience, not truth (05).
 *
 * Birthdates are memoized per service call via the caller-held cache,
 * because a report asks about the same files across many axioms.
 */
const derivePopulationService: Service<DerivePopulationInput, PopulationQualifier> = (
  cfg,
  { filePath, axiomIntroduced, birthdates },
) => {
  if (!birthdates.has(filePath)) {
    birthdates.set(filePath, fileFirstCommitDate(cfg.root, filePath));
  }

  const born = birthdates.get(filePath) ?? null;

  if (born === null) return "unknown";

  return born < axiomIntroduced ? "pre_spec" : "post_spec";
};

export default derivePopulationService;
