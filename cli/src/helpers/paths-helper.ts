import {
  basename,
  dirname,
  isAbsolute as nodeIsAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Path composition — the single home for it.
 *
 * Pure string math over paths, with no knowledge of what any of them
 * mean: where a Praxis project keeps its files is
 * `domains/workspace/models/project-paths.ts`. Outside this file and
 * core/files.ts, code imports these helpers rather than node:path
 * (ESLint's no-restricted-imports).
 */

/** Whether a path is absolute (see node:path isAbsolute). */
export function isAbsolute(path: string): boolean {
  return nodeIsAbsolute(path);
}

/** Joins path segments. */
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
