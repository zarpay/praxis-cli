import type { InitProjectOptions, Orchestrator } from "@/types.js";

import { ensureDir } from "@/helpers/files-helper.js";
import { joinPath, resolvePath } from "@/helpers/paths-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { SCAFFOLD_DIR } from "@/models/project-paths.js";
import copyScaffold from "@/services/copy-scaffold-service.js";
import initView from "@/views/init-view.js";

/**
 * Scaffolds a new Praxis project.
 *
 * The spec layer is opt-in: without `--spec-layer` a project gets the
 * minimal `.praxis/` tree and nothing else, because the eval layer is
 * what v2 *is* and the authoring taxonomy is one way to feed it.
 *
 * An existing file is never overwritten — init is safe to re-run, and
 * re-running with `--spec-layer` adds the taxonomy to a project that
 * started eval-only.
 */
export const initProjectOrchestrator: Orchestrator<InitProjectOptions> = async (
  ctx,
  { directory, scaffoldDir = SCAFFOLD_DIR, specLayer = false },
) => {
  const targetDir = resolvePath(directory);

  ensureDir(targetDir);

  // "eval" holds the minimal .praxis/ tree; "core" adds the spec-layer
  // authoring taxonomy (experts, practices, context).
  const { created, skipped } = copyScaffold({
    sourceDir: joinPath(scaffoldDir, specLayer ? "core" : "eval"),
    targetDir,
  });

  const view = initView({ created, skipped, nextSteps: nextSteps(specLayer) });
  ctx.render(view);

  return "ok";
};

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

export default prepareOrchestrator(initProjectOrchestrator);
