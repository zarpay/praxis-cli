import type { PraxisConfig } from "@/models/praxis-config.js";
import type { EvalCoverage, EvalCoverageSlice, EvalUnit, NoInput, Service } from "@/types.js";

import { Reviewer } from "@/models/reviewer.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import { DocumentStore } from "@/stores/document-store.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/**
 * Measures eval coverage: two slices over the source corpus — the
 * numbers a team maintains the way it maintains test coverage.
 *
 * `observed` is structural: files the eval layer's own discovery would
 * hand to a run, so it counts what a run actually covers rather than a
 * second guess at it, and it is accurate before the first run ever
 * happens. `passing` is the verdict-backed score a CI can rely on:
 * a file counts only when every configured reviewer's recorded verdict
 * for its unit is compliant — ungoverned, unreviewed, warned, and
 * failed files all count against it, and reviewers agreeing is the
 * bar, never an average.
 *
 * Pure read: the denominator is the document store's source sweep with
 * the authoring directories subtracted (an expert or practice is
 * direction, not corpus, wherever it lives), and verdicts come from the
 * committed cache — recorded state, the way `praxis status` reads it.
 * Governed files outside the sources (reachable via a spec's `paths:`)
 * affect neither side: coverage is a statement about the corpus, not
 * about the specs' reach.
 */
const measureEvalCoverageService: Service<NoInput, EvalCoverage> = (cfg) => {
  const corpus = corpusOf(cfg);
  const units = governedUnitsOf(cfg);

  const observedFiles = filesOf(units);
  const passingFiles = filesOf(passingUnitsOf(cfg, units));

  const sourceFiles = corpus.size;
  const observed = sliceOf(intersect(observedFiles, corpus), sourceFiles);
  const passing = sliceOf(intersect(passingFiles, corpus), sourceFiles);

  return { sourceFiles, observed, passing };
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

/** Every unit the eval layer's discovery would review. */
function governedUnitsOf(cfg: PraxisConfig): EvalUnit[] {
  const domains = discoverDomainsService(cfg, {});

  return domains.flatMap((domain) => resolveUnitsService(cfg, { domain }));
}

/**
 * The units whose recorded verdict passes for every configured
 * reviewer. One cache namespace per reviewer; the un-namespaced cache
 * when none are configured — the same readers `praxis status` tallies.
 */
function passingUnitsOf(cfg: PraxisConfig, units: EvalUnit[]): EvalUnit[] {
  const caches =
    cfg.reviewers.length > 0
      ? cfg.reviewers.map(
          (reviewer) =>
            new VerdictStore(cfg, { reviewer: Reviewer.fromConfig(reviewer).cacheIdentity() }),
        )
      : [new VerdictStore(cfg)];

  return units.filter((unit) =>
    caches.every((cache) => {
      const entry = cache.readEntry({ targetPath: unit.path });

      return entry !== null && entry.result.compliant;
    }),
  );
}

/** The member files of the given units, deduplicated. */
function filesOf(units: EvalUnit[]): Set<string> {
  const files = units.flatMap((unit) => unit.files);

  return new Set(files);
}

/** How many of the files fall inside the corpus. */
function intersect(files: Set<string>, corpus: Set<string>): number {
  return [...files].filter((file) => corpus.has(file)).length;
}

/** One slice with its render-ready form (09: numbers wear denominators). */
function sliceOf(files: number, sourceFiles: number): EvalCoverageSlice {
  if (sourceFiles === 0) return { files, rate: null, display: "no files under sources" };

  const rate = files / sourceFiles;
  const percent = Math.round(rate * 100);

  return { files, rate, display: `${percent}% (${files}/${sourceFiles} files)` };
}
