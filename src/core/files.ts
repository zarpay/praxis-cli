import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

/**
 * Standard file operations for the project.
 *
 * Every read, write, and existence check goes through this module so
 * the conventions live in one place: text is always UTF-8, writes
 * always create missing parent directories, and JSON is always written
 * pretty-printed with a trailing newline. Callers should not import
 * node:fs directly for these operations.
 */

/** Whether a file or directory exists at the given path. */
export function exists(path: string): boolean {
  return existsSync(path);
}

/** Reads a file as UTF-8 text. */
export function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

/**
 * Reads and parses a JSON file, cast to the caller's expected shape.
 *
 * Throws on unreadable files or invalid JSON; callers that need a
 * friendlier message catch and rethrow a PraxisError.
 */
export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

/** Writes UTF-8 text to a file, creating missing parent directories. */
export function writeText(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

/**
 * Writes a value as pretty-printed JSON (2-space indent, trailing
 * newline), creating missing parent directories.
 */
export function writeJson(path: string, value: unknown): void {
  writeText(path, JSON.stringify(value, null, 2) + "\n");
}

/** Copies a file, creating missing parent directories at the destination. */
export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

/** Creates a directory (and any missing parents); a no-op if it exists. */
export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/** Deletes a file. Throws if the path does not exist. */
export function removeFile(path: string): void {
  unlinkSync(path);
}
