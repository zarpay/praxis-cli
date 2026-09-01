import { readJson } from "@/core/files.js";

/**
 * The project's configuration, as written.
 *
 * Deliberately the raw file rather than the normalized `PraxisConfig`:
 * `praxis config show` exists so an author can see what *they* wrote
 * and where it lives, not what the defaults turned it into.
 *
 * @throws PraxisError when the file is absent or is not valid JSON
 */
export default function showConfig({ configPath }: { configPath: string }): {
  configPath: string;
  config: unknown;
} {
  return { configPath, config: readJson(configPath) };
}
