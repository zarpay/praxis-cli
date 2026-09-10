import type { Frontmatter } from "@/models/frontmatter.js";
import type { AxiomMode, AxiomStatus, Severity } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { MarkdownFile } from "@/models/markdown-file.js";

/** The accepted lifecycle states. */
const STATUSES: readonly AxiomStatus[] = ["proposed", "active", "deprecated"];

/** The accepted evaluation modes; `agentic` is schema-only. */
const MODES: readonly AxiomMode[] = ["judgment", "agentic"];

/** The accepted severities. */
const SEVERITIES: readonly Severity[] = ["error", "warning"];

/**
 * One axiom: a named, stable **category of recurring critique** — the
 * bucket evidence accumulates under. The norm lives in the spec the
 * axiom derives from; the axiom names the failure mode that keeps
 * recurring, so it can be counted, drilled into, and decided as a unit.
 *
 * The identity rules are the actual spec: an id is random-minted, never
 * reused and never renumbered; clarifying wording bumps `version`;
 * changing what the category covers is a new id. Every field is read
 * and validated in the constructor, so an AxiomFile that exists is a
 * valid axiom. Retired keys are tolerated: `grounded_in` parses as
 * `derived_from`; `supersedes` is ignored; `severity` and the example
 * sections are historical (categories carry neither — critiques carry
 * their own severities, and the ledger holds the real examples).
 *
 * @throws PraxisError when any declared field is malformed
 */
export class AxiomFile {
  /** Absolute path of the axiom file. */
  readonly path: string;
  /** Stable identity: `AX-` + 6 hex, minted at proposal, never reused. */
  readonly id: string;
  /** Wording revision; bumped only when the extension is unchanged. */
  readonly version: number;
  /** Lifecycle state; only `active` axioms label critiques or reach metrics. */
  readonly status: AxiomStatus;
  /** How the axiom is evaluated; `judgment` unless explicitly opted out. */
  readonly mode: AxiomMode;
  /** Historical: prescriptive-era axioms carried one; categories do not. */
  readonly severity: Severity | null;
  /**
   * The spec passage the accepted draft derived from — provenance
   * metadata, never identity: an axiom is a category derived from
   * critiques, and this pointer may go stale as specs move. Null only
   * on legacy files from before acceptance activated directly.
   */
  readonly derivedFrom: string | null;
  /** YYYY-MM-DD; this axiom's population clock starts here. */
  readonly introduced: string;
  /** The statement, as authored; historical files may carry example sections. */
  readonly body: string;

  private constructor(fields: Frontmatter, body: string, path: string) {
    this.path = path;
    this.id = validId(fields.requiredString("id"), path);
    this.version = fields.requiredInt("version");
    this.status = fields.enumValue("status", STATUSES) ?? raiseMissing("status", path);
    this.mode = fields.enumValue("mode", MODES) ?? "judgment";
    this.severity = fields.enumValue("severity", SEVERITIES) ?? null;
    this.derivedFrom =
      fields.optionalString("derived_from") ?? fields.optionalString("grounded_in") ?? null;
    this.introduced = fields.requiredDate("introduced");
    this.body = body;
  }

  /**
   * The spec file the category derives from — `derivedFrom` without its
   * `#section` anchor. Null when a legacy file carries no provenance.
   */
  derivedFromSpec(): string | null {
    if (this.derivedFrom === null) return null;

    return this.derivedFrom.split("#")[0] ?? null;
  }

  /** Reads and validates an axiom from already-loaded content. */
  static fromContent(content: string, path: string): AxiomFile {
    const document = MarkdownFile.fromContent(content, path);

    return new AxiomFile(document.frontmatter, document.body, path);
  }

  /**
   * What the axiom asserts: the body text before its first section
   * heading. This is the line checklists and findings carry; the
   * examples stay behind `axioms show`.
   */
  statement(): string {
    const headingStart = this.body.indexOf("\n## ");

    const lead = headingStart === -1 ? this.body : this.body.slice(0, headingStart);

    return lead.trim();
  }

  /** The violating example's text, or empty when the section is absent. */
  violatingExample(): string {
    return this.section("Violating example");
  }

  /** The compliant example's text, or empty when the section is absent. */
  compliantExample(): string {
    return this.section("Compliant example");
  }

  /** One `## <name>` section's text, without its heading. */
  private section(name: string): string {
    const heading = `## ${name}`;
    const start = this.body.indexOf(heading);

    if (start === -1) return "";

    const rest = this.body.slice(start + heading.length);
    const nextHeading = rest.indexOf("\n## ");

    return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
  }
}

/**
 * Validates the id shape: `AX-` + 6 lowercase hex. Random-minted, so
 * two contributors on separate branches can never fuse two standards
 * under one identity in a merge.
 */
function validId(id: string, path: string): string {
  if (!/^AX-[0-9a-f]{6}$/.test(id)) {
    throw errors.invalidFrontmatterField("id", path, "an id like AX-3f9c2d", id);
  }

  return id;
}

/** Raises for a required enum key the document omitted. */
function raiseMissing(key: string, path: string): never {
  throw errors.missingFrontmatterField(key, path);
}
