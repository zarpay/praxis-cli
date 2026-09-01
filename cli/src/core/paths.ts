import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Standard path operations for the project.
 *
 * Alongside the well-known Praxis locations below, this module is the
 * single home for path composition: outside of core/files.ts and this
 * file, code imports these helpers instead of node:path (enforced by
 * ESLint's no-restricted-imports).
 */

/** Joins path segments (see node:path join). */
export function joinPath(...segments: string[]): string {
  return join(...segments);
}

/** Resolves path segments to an absolute path (see node:path resolve). */
export function resolvePath(...segments: string[]): string {
  return resolve(...segments);
}

/** The relative path from one location to another (see node:path relative). */
export function relativePath(from: string, to: string): string {
  return relative(from, to);
}

/** Converts an absolute path to a file:// URL string (for dynamic import()). */
export function fileUrl(absolutePath: string): string {
  return pathToFileURL(absolutePath).href;
}

/** The last segment of a path, optionally with an extension stripped. */
export function baseName(path: string, ext?: string): string {
  return basename(path, ext);
}

/** The directory containing a path (see node:path dirname). */
export function parentDir(path: string): string {
  return dirname(path);
}
