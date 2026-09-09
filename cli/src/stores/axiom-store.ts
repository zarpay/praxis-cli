import type { PraxisConfig } from "@/models/praxis-config.js";
import type { ActiveAxiom, ListAxiomsResult, Severity, StoreProblem } from "@/types.js";

import { randomBytes } from "node:crypto";

import { errors } from "@/helpers/errors-helper.js";
import {
  exists,
  listFilesRecursive,
  readText,
  removeFile,
  writeText,
} from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { AxiomFile } from "@/models/axiom-file.js";
import axiomFileTemplate from "@/templates/axiom-file-template.js";

/** Where the proposal landed. */
interface WriteAxiomProposalResult {
  id: string;
  path: string;
}

/**
 * The project's axiom store: `.praxis/axioms/` and its `proposed/`
 * subdirectory.
 *
 * One handle owns the layout, the id minting, and the lifecycle moves —
 * propose lands a draft, ratify grounds and activates it. The store's
 * lifecycle events are methods here, not services; what stays outside
 * is everything that *decides* — triage, curation, traceability — which
 * is curator and human work the orchestrators drive.
 */
export class AxiomStore {
  private readonly projectRoot: string;
  private readonly axiomsDir: string;
  private readonly proposedDir: string;

  constructor(cfg: PraxisConfig) {
    this.projectRoot = cfg.root;
    this.axiomsDir = joinPath(cfg.root, ".praxis", "axioms");
    this.proposedDir = joinPath(cfg.root, ".praxis", "axioms", "proposed");
  }

  /**
   * Every axiom in the store — active, deprecated, and proposed.
   *
   * One malformed file never takes down the sweep: it is reported in
   * `problems` and the rest still loads. Sorted by `introduced` date
   * with id as tiebreak — random ids carry no order, the frontmatter does.
   */
  all(): ListAxiomsResult {
    if (!exists(this.axiomsDir)) return { axioms: [], problems: [] };

    const axioms: AxiomFile[] = [];
    const problems: StoreProblem[] = [];

    for (const file of listFilesRecursive(this.axiomsDir)) {
      if (!file.endsWith(".md")) continue;

      const path = joinPath(this.axiomsDir, file);

      try {
        axioms.push(AxiomFile.fromContent(readText(path), path));
      } catch (err) {
        problems.push({ path, message: err instanceof Error ? err.message : String(err) });
      }
    }

    axioms.sort(byIntroducedThenId);

    return { axioms, problems };
  }

  /**
   * The labeling set: every **active** axiom, sorted by id so
   * identical state always renders identical bytes.
   *
   * An axiom is an abstraction over evidence, never a child of one spec
   *: multiple specs can state in prose the same
   * principle an axiom captures discretely, so a critique from any spec
   * can label into any active axiom — `derived_from` is provenance of
   * birth, not a labeling scope. Proposed axioms have no metric effect
   * and never label; deprecated ones stopped being asked.
   */
  active(): ActiveAxiom[] {
    return this.all()
      .axioms.filter((axiom) => axiom.status === "active")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((axiom) => ({
        id: axiom.id,
        version: axiom.version,
        severity: axiom.severity,
        statement: axiom.statement(),
        body: axiom.body,
      }));
  }

  /**
   * Lands one triage-accepted draft in `proposed/`: a freshly
   * minted id, `status: proposed`, no derivation — ratification
   * establishes that, and `status: active` is a human decision this
   * store never makes on its own.
   */
  propose(draft: {
    statement: string;
    severity: Severity;
    violatingExample: string;
    compliantExample: string;
  }): WriteAxiomProposalResult {
    const id = this.mintId();

    const document = axiomFileTemplate({
      id,
      status: "proposed",
      mode: "judgment",
      severity: draft.severity,
      introduced: new Date().toISOString().slice(0, 10),
      derivedFrom: null,
      statement: draft.statement,
      violatingExample: draft.violatingExample,
      compliantExample: draft.compliantExample,
    });

    const path = joinPath(this.proposedDir, `${id}.md`);

    writeText(path, document);

    return { id, path };
  }

  /**
   * Ratification's store move: the proposal becomes active and
   * records its derivation, leaving `proposed/`.
   *
   * The body is preserved byte-for-byte — a human may have edited the
   * proposal file, and ratifying must never rewrite what a human
   * authored. Only two frontmatter facts change, and the result is
   * validated through the model before anything lands on disk.
   *
   * @throws PraxisError when the moved document would not validate
   */
  ratify(id: string, derivedFrom: string): WriteAxiomProposalResult {
    const proposedPath = joinPath(this.proposedDir, `${id}.md`);
    const activePath = joinPath(this.axiomsDir, `${id}.md`);

    const proposal = readText(proposedPath);
    const ratified = proposal
      .replace(/^status: proposed$/m, "status: active")
      .replace(/^introduced:/m, `derived_from: ${derivedFrom}\nintroduced:`);

    // Refuse to write anything the model would reject.
    AxiomFile.fromContent(ratified, activePath);

    writeText(activePath, ratified);
    removeFile(proposedPath);

    return { id, path: activePath };
  }

  /**
   * Retires an active axiom: `status: active` flips to
   * `deprecated`, body preserved byte-for-byte. The id and its records
   * stay readable forever; the recorded reason is the caller's to land
   * in the triage ledger.
   *
   * @throws PraxisError when no active axiom file carries the id, or
   *   the amended document would not validate
   */
  deprecate(id: string): WriteAxiomProposalResult {
    const path = joinPath(this.axiomsDir, `${id}.md`);

    if (!exists(path)) throw errors.axiomNotFound(id);

    const current = readText(path);
    const retired = current.replace(/^status: active$/m, "status: deprecated");

    // Refuse to write anything the model would reject.
    AxiomFile.fromContent(retired, path);

    writeText(path, retired);

    return { id, path };
  }

  /**
   * Rewrites an active axiom's `introduced` date — the population
   * clock. Only `axioms merge` calls this, so the survivor inherits the
   * earliest clock among the merged: critiques folded in retroactively
   * must not be misread as pre-spec debt.
   *
   * @throws PraxisError when no axiom file carries the id, or the
   *   amended document would not validate
   */
  amendIntroduced(id: string, introduced: string): WriteAxiomProposalResult {
    const path = joinPath(this.axiomsDir, `${id}.md`);

    if (!exists(path)) throw errors.axiomNotFound(id);

    const current = readText(path);
    const amended = current.replace(/^introduced: .*$/m, `introduced: ${introduced}`);

    // Refuse to write anything the model would reject.
    AxiomFile.fromContent(amended, path);

    writeText(path, amended);

    return { id, path };
  }

  /**
   * Mints a new axiom id: `AX-` + 6 lowercase hex.
   *
   * Random, never sequential: two contributors triaging on separate
   * branches must not be able to mint the same id for different
   * standards — a merge would silently fuse two meanings under one
   * identity. The store check is belt-and-braces for the astronomically
   * unlikely local collision; cross-branch safety comes from the
   * 16.7M-id space.
   */
  private mintId(): string {
    for (;;) {
      const id = `AX-${randomBytes(3).toString("hex")}`;

      const taken =
        exists(joinPath(this.axiomsDir, `${id}.md`)) ||
        exists(joinPath(this.proposedDir, `${id}.md`));

      if (!taken) return id;
    }
  }
}

/** Chronological order, ids breaking ties so equal dates stay stable. */
function byIntroducedThenId(a: AxiomFile, b: AxiomFile): number {
  if (a.introduced !== b.introduced) return a.introduced < b.introduced ? -1 : 1;

  return a.id.localeCompare(b.id);
}
