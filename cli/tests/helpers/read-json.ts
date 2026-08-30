import { readFileSync } from "node:fs";

/**
 * Reads and parses a JSON file, cast to the caller's expected shape.
 *
 * Test-only convenience: production code should validate parsed JSON,
 * but tests are asserting against files they just wrote, so a cast
 * keeps assertions readable without `any` leaking in.
 */
export function readJsonFile<T = Record<string, unknown>>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}
