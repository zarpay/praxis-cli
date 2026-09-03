import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The frontmatter every fixture starts from; tests override per case. */
const DEFAULT_FIELDS: Record<string, string> = {
  id: "AX-aaaa11",
  version: "1",
  status: "active",
  severity: "error",
  introduced: "2026-08-29",
};

/** The body every fixture starts from: a statement plus both examples. */
const DEFAULT_BODY = [
  "Statement of the standard.",
  "",
  "## Violating example",
  "",
  "bad",
  "",
  "## Compliant example",
  "",
  "good",
].join("\n");

/**
 * Markdown for one axiom document.
 *
 * Overrides replace frontmatter values; `null` removes the key, which is
 * how validation tests build invalid documents. A `statement` option
 * swaps the default body's first line; a `body` option replaces the
 * whole body.
 */
export function axiomContent(
  overrides: Record<string, string | null> = {},
  options: { statement?: string; body?: string } = {},
): string {
  const fields = { ...DEFAULT_FIELDS, ...overrides };

  const frontmatter = Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`);

  return ["---", ...frontmatter, "---", "", bodyFor(options)].join("\n");
}

/** The body an axiomContent call asked for. */
function bodyFor(options: { statement?: string; body?: string }): string {
  if (options.body !== undefined) return options.body;

  if (options.statement !== undefined) {
    return DEFAULT_BODY.replace("Statement of the standard.", options.statement);
  }

  return DEFAULT_BODY;
}

/**
 * Writes one axiom into a project's store (or its `proposed/` subdir)
 * and returns its path. The id lands in the frontmatter and the
 * filename, and the default statement names it, so list assertions read.
 */
export function seedAxiom(
  root: string,
  id: string,
  fields: Record<string, string | null> & { proposed?: boolean; statement?: string } = {},
): string {
  const { proposed, statement, ...overrides } = fields;

  const dir = proposed
    ? join(root, ".praxis", "axioms", "proposed")
    : join(root, ".praxis", "axioms");
  const path = join(dir, `${id}.md`);
  const content = axiomContent(
    { id, ...overrides },
    { statement: statement ?? `Statement of ${id}.` },
  );

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);

  return path;
}
