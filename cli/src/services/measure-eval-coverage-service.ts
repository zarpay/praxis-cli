import type { PraxisConfig } from "@/models/praxis-config.js";
import type { EvalCoverage, NoInput, Service } from "@/types.js";

import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import { DocumentStore } from "@/stores/document-store.js";

/**
 * Measures eval coverage: the share of the source corpus at least one
 * spec governs — the number a team maintains the way it maintains test
 * coverage.
 *
 * Pure read: the denominator is the document store's source sweep with
 * the authoring directories subtracted (an expert or practice is
 * direction, not corpus, wherever it lives), and the numerator comes
 * from the eval layer's own discovery — the same units a run would
 * review, so coverage counts what a run actually covers rather than a
 * second guess at it. Governed files outside the sources (reachable via
 * a spec's `paths:`) affect neither side: coverage is a statement about
 * the corpus, not about the specs' reach.
 */
const measureEvalCoverageService: Service<NoInput, EvalCoverage> = (cfg) => {
  const corpus = corpusOf(cfg);
  const governedFiles = governedFilesOf(cfg);

  const governed = [...corpus].filter((file) => governedFiles.has(file)).length;
  const sourceFiles = corpus.size;
  const rate = sourceFiles === 0 ? null : governed / sourceFiles;

  return { governed, sourceFiles, rate, display: displayOf(governed, sourceFiles, rate) };
};

export default measureEvalCoverageService;

/** Every reviewable source file, minus the authored taxonomy. */
function corpusOf(cfg: PraxisConfig): Set<string> {
  const documentStore = new DocumentStore(cfg);
  const swept = documentStore.sourceFiles();

  // The config resolves these to absolute paths already.
  const authoringDirs = [cfg.expertsDir, cfg.practicesDir, cfg.agentProfilesOutputDir];
  const authoringRoots = authoringDirs.filter((dir) => dir !== null).map((dir) => `${dir}/`);

  const corpus = swept.filter(
    (file) => !authoringRoots.some((authoringRoot) => file.startsWith(authoringRoot)),
  );

  return new Set(corpus);
}

/** Every file the eval layer's discovery would review. */
function governedFilesOf(cfg: PraxisConfig): Set<string> {
  const domains = discoverDomainsService(cfg, {});

  const files = domains.flatMap((domain) => {
    const units = resolveUnitsService(cfg, { domain });

    return units.flatMap((unit) => unit.files);
  });

  return new Set(files);
}

/** The one render-ready form every surface prints (09: numbers wear denominators). */
function displayOf(governed: number, sourceFiles: number, rate: number | null): string {
  if (rate === null) return "no files under sources";

  const percent = Math.round(rate * 100);

  return `${percent}% (${governed}/${sourceFiles} files)`;
}
