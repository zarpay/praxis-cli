import type { CommandContext } from "@/domains/workspace/models/command-context.js";
import type { InitProjectOptions } from "@/domains/workspace/types.js";

import {
  copyFile,
  ensureDir,
  exists,
  listFilesRecursive,
  readText,
  writeText,
} from "@/core/files.js";
import { joinPath, relativePath, resolvePath } from "@/core/paths.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { SCAFFOLD_DIR } from "@/domains/workspace/models/project-paths.js";
import { initReport } from "@/domains/workspace/views/status.js";
import { renderReport } from "@/views/report.js";

/**
 * Scaffolds a new Praxis project.
 *
 * Copies the core scaffold, then each enabled plugin's own files. The
 * spec layer is opt-in: without `--spec-layer` a project gets the
 * minimal `.praxis/` tree and nothing else, because the eval layer is
 * what v2 *is* and the authoring taxonomy is one way to feed it.
 *
 * An existing file is never overwritten — init is safe to re-run, and
 * re-running with `--spec-layer` adds the taxonomy to a project that
 * started eval-only.
 */
export default async function initProject(
  ctx: CommandContext,
  { directory, scaffoldDir = SCAFFOLD_DIR, specLayer = false }: InitProjectOptions,
): Promise<void> {
  const targetDir = resolvePath(directory);
  const onFileCreated = (path: string) => ctx.logger.success(`Created ${path}`);

  ensureDir(targetDir);

  // "eval" holds the minimal .praxis/ tree; "core" adds the spec-layer
  // authoring taxonomy (experts, practices, context).
  const core = copyScaffold({
    sourceDir: joinPath(scaffoldDir, specLayer ? "core" : "eval"),
    targetDir,
    displayRoot: targetDir,
    onFileCreated,
  });

  let created = core.created;
  let skipped = core.skipped;

  // Config is read *after* the core copy: the scaffold is what puts it
  // there on a fresh project.
  for (const plugin of new PraxisConfig(targetDir).plugins) {
    const sourceDir = joinPath(scaffoldDir, "plugins", plugin.name);

    if (!exists(sourceDir)) continue;

    const result = copyScaffold({
      sourceDir,
      targetDir: plugin.outputDir
        ? resolvePath(targetDir, plugin.outputDir)
        : joinPath(targetDir, "plugins", "praxis"),
      displayRoot: targetDir,
      templateVars: { claudeCodePluginName: plugin.claudeCodePluginName ?? "praxis" },
      onFileCreated,
    });

    created += result.created;
    skipped += result.skipped;
  }

  renderReport(initReport({ created, skipped, nextSteps: nextSteps(specLayer) }), {
    out: ctx.out,
    logger: ctx.logger,
  });
}

/**
 * Copies a scaffold tree, skipping anything already present.
 *
 * Template variables are substituted in `.json` files only, which is
 * where the plugin manifests carry them.
 */
function copyScaffold({
  sourceDir,
  targetDir,
  displayRoot,
  templateVars = {},
  onFileCreated,
}: {
  sourceDir: string;
  targetDir: string;
  /** Root the reported path is shown relative to. */
  displayRoot: string;
  templateVars?: Record<string, string>;
  onFileCreated?: (path: string) => void;
}): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;

  for (const relPath of listFilesRecursive(sourceDir)) {
    const destPath = joinPath(targetDir, relPath);

    if (exists(destPath)) {
      skipped++;
      continue;
    }

    const srcPath = joinPath(sourceDir, relPath);

    if (relPath.endsWith(".json") && Object.keys(templateVars).length > 0) {
      writeText(destPath, applyTemplate(readText(srcPath), templateVars));
    } else {
      copyFile(srcPath, destPath);
    }

    onFileCreated?.(relativePath(displayRoot, destPath));
    created++;
  }

  return { created, skipped };
}

/** Substitutes `{key}` placeholders in scaffold content. */
function applyTemplate(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    content,
  );
}

/** Post-init guidance, matched to what was actually scaffolded. */
function nextSteps(specLayer: boolean): string[] {
  if (specLayer) {
    return [
      "  1. Edit context/constitution/ to define your organization's identity",
      "  2. Edit context/conventions/ to document your standards",
      "  3. Run `praxis compile` to generate agent files",
      "  4. Define new experts in experts/ as your organization grows",
    ];
  }

  return [
    "  1. Edit .praxis/config.json: point sources at the directories your specs live in",
    "  2. Write a spec (README.md) in a directory whose files it should govern",
    "  3. Set your reviewer's API key and run `praxis eval run`",
    "  4. Re-run `praxis init --spec-layer` later to add the authoring taxonomy",
  ];
}
