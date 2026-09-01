import { readText } from "@/core/files.js";
import { Frontmatter } from "@/core/frontmatter.js";

/**
 * Reads a markdown file's prose, frontmatter stripped and trimmed.
 *
 * What the compiler inlines from a referenced document: its content,
 * without the metadata that governed how it was found.
 *
 * @param path - Absolute path to the markdown file
 */
export default function readMarkdownBody(path: string): string {
  return Frontmatter.fromContent(readText(path)).body().trim();
}
