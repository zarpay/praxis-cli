/**
 * Text shaping for display.
 *
 * Formatting a string for a human to read — never parsing, never I/O.
 * Anything that reads a file lives in `files-helper.ts`; anything that
 * composes a path lives in `paths-helper.ts`.
 */

/** Converts a kebab-case name to Title Case: "code-reviewer" → "Code Reviewer". */
export function kebabToTitleCase(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
