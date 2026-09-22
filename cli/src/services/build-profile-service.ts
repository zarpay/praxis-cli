import type { Service } from "@/types.js";

/** The content blocks a compiled profile is assembled from. */
interface BuildProfileInput {
  /** The expert's own prose. */
  expert: string;
  /** Practice bodies, inlined. */
  practices: string[];
  /** Constitution bodies, inlined. */
  constitution: string[];
  /** Context bodies, inlined. */
  context: string[];
  /** Reference bodies, inlined. */
  reference: string[];
}

/** Separator between items in Practices, Context, and Reference sections. */
const RULE = "\n---\n";

/** Separator between items in the Constitution section. */
const BLANK = "\n";

/**
 * Assembles a compiled agent profile from its content blocks.
 *
 * Sections appear in a fixed order — Expert, Practices, Constitution,
 * Context, Reference — and an empty section is omitted rather than
 * rendered as a bare heading. The headings carry the v2 vocabulary
 * (v1's Role/Responsibilities; renamed 2026-09-22).
 *
 * The separator differs by section on purpose: constitution blocks are
 * one continuous statement of identity and read wrong split by rules,
 * while the others are distinct documents and want the break.
 *
 * The result is a *pure* profile. Platform-specific wrapping (Claude
 * Code frontmatter and the like) belongs to the compiler plugins.
 */
const buildProfileService: Service<BuildProfileInput, string> = (
  _cfg,
  { expert, practices, constitution, context, reference },
) => {
  const sections = [
    expert && section("Expert", [expert], BLANK),
    practices.length > 0 && section("Practices", practices, RULE),
    constitution.length > 0 && section("Constitution", constitution, BLANK),
    context.length > 0 && section("Context", context, RULE),
    reference.length > 0 && section("Reference", reference, RULE),
  ];

  return sections.filter((s): s is string => Boolean(s)).join("\n");
};

export default buildProfileService;

/** One titled section: a heading, then its blocks joined by `separator`. */
function section(title: string, contents: string[], separator: string): string {
  return `# ${title}\n\n${contents.join(separator)}\n`;
}
