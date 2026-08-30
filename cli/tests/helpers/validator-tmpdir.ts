import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import type { ValidationConfig } from "@/core/config.js";

const DEFAULT_VALIDATION: ValidationConfig = {
  apiKeyEnvVar: "OPENROUTER_API_KEY",
  model: "test",
};

/**
 * Creates a minimal Praxis project root in a temp directory for validator tests.
 *
 * Accepts a flat map of relative paths to file contents — parent directories are
 * created automatically, so deeply nested files don't require explicit `mkdirSync`
 * calls. A `.praxis/config.json` is written with the given sources and validation
 * config (defaults: OPENROUTER_API_KEY key, "test" model).
 *
 * @returns `root` (absolute path), `abs` (path resolver), and `cleanup` (rm -rf).
 */
export function createValidatorTmpdir(options: {
  sources: string[];
  files: Record<string, string>;
  validation?: Partial<ValidationConfig>;
}): {
  root: string;
  abs: (relativePath: string) => string;
  cleanup: () => void;
} {
  const root = join(tmpdir(), `praxis-validator-${randomUUID()}`);
  const abs = (rel: string) => join(root, rel);

  mkdirSync(join(root, ".praxis"), { recursive: true });

  for (const [relPath, content] of Object.entries(options.files)) {
    const fullPath = abs(relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  writeFileSync(
    abs(".praxis/config.json"),
    JSON.stringify({
      sources: options.sources,
      validation: { ...DEFAULT_VALIDATION, ...options.validation },
    }),
  );

  return { root, abs, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
