import type { JudgeConfig } from "@/core/config.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** The judge written into helper configs; matches TEST_JUDGE in openrouter-msw. */
const DEFAULT_JUDGES: JudgeConfig[] = [
  { name: "test", model: "test-model", apiKeyEnvVar: "OPENROUTER_API_KEY" },
];

/**
 * Creates a minimal Praxis project root in a temp directory for eval tests.
 *
 * Accepts a flat map of relative paths to file contents — parent directories are
 * created automatically, so deeply nested files don't require explicit `mkdirSync`
 * calls. A `.praxis/config.json` is written with the given sources, judges
 * (default: one OpenRouter test judge), and spec file pattern.
 *
 * @returns `root` (absolute path), `abs` (path resolver), and `cleanup` (rm -rf).
 */
export function createValidatorTmpdir(options: {
  sources: string[];
  files: Record<string, string>;
  judges?: JudgeConfig[];
  specFilePattern?: string;
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
      judges: options.judges ?? DEFAULT_JUDGES,
      ...(options.specFilePattern !== undefined && { specFilePattern: options.specFilePattern }),
    }),
  );

  return { root, abs, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
