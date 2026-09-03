import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  AxiomScope,
  ChecklistAxiom,
  ListAxiomsResult,
  Severity,
  StoreProblem,
  WriteAxiomProposalResult,
} from "@/types.js";

import { randomBytes } from "node:crypto";

import {
  exists,
  listFilesRecursive,
  readText,
  removeFile,
  writeText,
} from "@/helpers/files-helper.js";
import { joinPath, relativePath } from "@/helpers/paths-helper.js";
import { AxiomFile } from "@/models/axiom-file.js";
import axiomFileTemplate from "@/templates/axiom-file-template.js";

/**
 * The project's axiom store: `.praxis/axioms/` and its `proposed/`
 * subdirectory (04, 10).
 *
 * One handle owns the layout, the id minting, and the lifecycle moves —
 * propose lands a draft, ratify grounds and activates it. The store's
 * lifecycle events are methods here, not services; what stays outside
 * is everything that *decides* — triage, the gate, traceability — which
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
   * The checklist channel for one spec (04): every **active** axiom
   * whose `grounded_in` names it, sorted by id so identical state
   * always renders — and hashes — identical bytes.
   *
   * Proposed axioms have no metric effect and never reach the reviewer;
   * deprecated ones stopped being asked. Grounding is per-spec (04's
   * cross-spec question stays open): `grounded_in`'s path segment must
   * equal the spec's project-relative path.
   */
  checklistFor(specPath: string): ChecklistAxiom[] {
    const spec = relativePath(this.projectRoot, specPath);

    return this.all()
      .axioms.filter((axiom) => axiom.status === "active")
      .filter((axiom) => axiom.groundedIn !== null && axiom.groundedIn.split("#")[0] === spec)
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
   * Lands one triage-accepted draft in `proposed/` (04): a freshly
   * minted id, `status: proposed`, no grounding — ratification
   * establishes that, and `status: active` is a human decision this
   * store never makes on its own.
   */
  propose(draft: {
    statement: string;
    severity: Severity;
    scope: AxiomScope;
    violatingExample: string;
    compliantExample: string;
  }): WriteAxiomProposalResult {
    const id = this.mintId();

    const document = axiomFileTemplate({
      id,
      status: "proposed",
      mode: "judgment",
      scope: draft.scope,
      severity: draft.severity,
      introduced: new Date().toISOString().slice(0, 10),
      groundedIn: null,
      statement: draft.statement,
      violatingExample: draft.violatingExample,
      compliantExample: draft.compliantExample,
    });

    const path = joinPath(this.proposedDir, `${id}.md`);

    writeText(path, document);

    return { id, path };
  }

  /**
   * Ratification's store move (04): the proposal becomes active and
   * records its grounding, leaving `proposed/`.
   *
   * The body is preserved byte-for-byte — a human may have edited the
   * proposal file, and ratifying must never rewrite what a human
   * authored (10). Only two frontmatter facts change, and the result is
   * validated through the model before anything lands on disk.
   *
   * @throws PraxisError when the moved document would not validate
   */
  ratify(id: string, groundedIn: string): WriteAxiomProposalResult {
    const proposedPath = joinPath(this.proposedDir, `${id}.md`);
    const activePath = joinPath(this.axiomsDir, `${id}.md`);

    const proposal = readText(proposedPath);
    const ratified = proposal
      .replace(/^status: proposed$/m, "status: active")
      .replace(/^introduced:/m, `grounded_in: ${groundedIn}\nintroduced:`);

    // Refuse to write anything the model would reject.
    AxiomFile.fromContent(ratified, activePath);

    writeText(activePath, ratified);
    removeFile(proposedPath);

    return { id, path: activePath };
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
