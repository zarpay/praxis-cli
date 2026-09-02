import type { CompileProgress, CompileProjectOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import compileByAlias from "@/services/compile-by-alias-service.js";
import compileExperts from "@/services/compile-experts-service.js";
import resolvePlugins from "@/services/resolve-plugins-service.js";
import watchAndCompile from "@/services/watch-and-compile-service.js";
import compileProgressView from "@/views/compile-progress-view.js";
import compileResultView from "@/views/compile-result-view.js";
import watchView from "@/views/watch-view.js";

/**
 * What `praxis compile` does: turn expert definitions into agent profiles
 * and run whatever plugins the project enables.
 *
 * Three shapes of the same job — one expert by alias, every expert once,
 * or every expert and then again on every change. They share the compile
 * scope, so the dispatch lives here rather than in the route.
 */
export const compileProjectOrchestrator: Orchestrator<CompileProjectOptions> = async (
  ctx,
  { alias, watch = false },
) => {
  const { root, config, logger } = ctx;

  // Plugins are constructed once per invocation, not per expert: the
  // Claude Code plugin writes its manifest on first compile and must not
  // repeat it for every agent.
  const input = {
    root,
    expertsDir: config.expertsDir,
    specFilePattern: config.specFilePattern,
    agentProfilesOutputDir: config.agentProfilesOutputDir,
    plugins: resolvePlugins(config.plugins, root, logger),
    onProgress: (event: CompileProgress) => ctx.render(compileProgressView(event)),
  };

  if (alias) {
    const result = await compileByAlias({ ...input, alias, expertsDir: config.expertsDir });

    ctx.render(compileResultView(result));

    if (watch) logger.warn("--watch is not supported with --alias, ignoring");

    return;
  }

  const { compiled } = await compileExperts(input);

  ctx.render(compileResultView({ compiled }));

  if (!watch) return;

  watchAndCompile({
    ...input,
    sources: config.sources,
    onWatch: (dir) => ctx.render(watchView({ kind: "watching", dir })),
    onRecompile: (filename) => ctx.render(watchView({ kind: "recompiling", filename })),
    onError: (message) => logger.error(message),
  });
};

export default prepareOrchestrator(compileProjectOrchestrator);
