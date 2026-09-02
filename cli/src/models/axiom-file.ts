import type { Frontmatter } from "@/models/frontmatter.js";
import type { AxiomMode, AxiomScope, AxiomStatus, Severity } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { MarkdownFile } from "@/models/markdown-file.js";

/** The accepted lifecycle states (04). */
const STATUSES: readonly AxiomStatus[] = ["proposed", "active", "deprecated"];

/** The accepted evaluation modes (03); `agentic` is schema-only. */
const MODES: readonly AxiomMode[] = ["judgment", "agentic"];

/** The accepted judgment scopes (03); the runtime honors file and file+context. */
const SCOPES: readonly AxiomScope[] = ["hunk", "file", "file+context", "cohort", "changeset"];

/** The accepted severities. */
const SEVERITIES: readonly Severity[] = ["error", "warning"];

/**
 * One axiom: a single, discrete, named standard (04).
 *
 * The identity rules are the actual spec: an id is random-minted, never
 * reused and never renumbered; clarifying wording bumps `version`;
 * changing what counts as a violation is a new id with `supersedes`.
 * Every field is read and validated in the constructor, so an AxiomFile
 * that exists is a valid axiom.
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
  /** Lifecycle state; only `active` axioms reach the reviewer or metrics. */
  readonly status: AxiomStatus;
  /** How the axiom is evaluated; `judgment` unless explicitly opted out. */
  readonly mode: AxiomMode;
  /** What the reviewer reads to decide it. */
  readonly scope: AxiomScope;
  /** Extra files inlined for `file+context` scope, as written. */
  readonly context: string[];
  /** What a violation of this axiom costs a verdict. */
  readonly severity: Severity;
  /** The spec criterion that grounds it; null until ratification. */
  readonly groundedIn: string | null;
  /** YYYY-MM-DD; this axiom's population clock starts here (01, 04). */
  readonly introduced: string;
  /** The axiom this one replaced, when meaning changed. */
  readonly supersedes: string | undefined;
  /** Statement and examples, as authored. */
  readonly body: string;

  private constructor(fields: Frontmatter, body: string, path: string) {
    this.path = path;
    this.id = validId(fields.requiredString("id"), path);
    this.version = fields.requiredInt("version");
    this.status = fields.enumValue("status", STATUSES) ?? raiseMissing("status", path);
    this.mode = fields.enumValue("mode", MODES) ?? "judgment";
    this.scope = fields.enumValue("scope", SCOPES) ?? "file";
    this.context = fields.stringList("context");
    this.severity = fields.enumValue("severity", SEVERITIES) ?? raiseMissing("severity", path);
    this.groundedIn = fields.optionalString("grounded_in") ?? null;
    this.introduced = fields.requiredDate("introduced");
    this.supersedes = fields.optionalString("supersedes");
    this.body = body;
  }

  /** Reads and validates an axiom from disk. */
  static at(path: string): AxiomFile {
    const document = MarkdownFile.at(path);

    return new AxiomFile(document.frontmatter, document.body, path);
  }

  /** Reads and validates an axiom from already-loaded content. */
  static fromContent(content: string, path: string): AxiomFile {
    const document = MarkdownFile.fromContent(content, path);

    return new AxiomFile(document.frontmatter, document.body, path);
  }

  /**
   * What the axiom asserts: the body text before its first section
   * heading. This is the line checklists and findings carry; the
   * examples stay behind `axioms show` (09, token economy).
   */
  statement(): string {
    const headingStart = this.body.indexOf("\n## ");

    const lead = headingStart === -1 ? this.body : this.body.slice(0, headingStart);

    return lead.trim();
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
