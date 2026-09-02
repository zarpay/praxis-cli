import type { CompileProjectOptions } from "@/domains/spec/types.js";
import type { Orchestrator } from "@/domains/workspace/types.js";

import compileByAlias from "@/domains/spec/services/compile-by-alias.js";
import compileExperts from "@/domains/spec/services/compile-experts.js";
import resolvePlugins from "@/domains/spec/services/resolve-plugins.js";
import watchAndCompile from "@/domains/spec/services/watch-and-compile.js";
import {
  compileProgressLine,
  compiledCount,
  compiledOneLines,
  recompilingLine,
  watchingLine,
} from "@/domains/spec/views/compile-progress.js";
import { renderReport } from "@/views/report.js";

/**
 * What `praxis compile` does: turn expert definitions into agent profiles
 * and run whatever plugins the project enables.
 *
 * Three shapes of the same job — one expert by alias, every expert once,
 * or every expert and then again on every change. They share the compile
 * scope, so the dispatch lives here rather than in the route.
 */
const compileProject: Orchestrator<CompileProjectOptions> = async (
  ctx,
  { alias, watch = false },
) => {
  const { root, config, logger } = ctx;
  const render = (lines: Parameters<typeof renderReport>[0]) =>
    renderReport(lines, { out: ctx.out, logger });

  // Plugins are constructed once per invocation, not per expert: the
  // Claude Code plugin writes its manifest on first compile and must not
  // repeat it for every agent.
  const input = {
    root,
    expertsDir: config.expertsDir,
    specFilePattern: config.specFilePattern,
    agentProfilesOutputDir: config.agentProfilesOutputDir,
    plugins: resolvePlugins(config.plugins, root, logger),
    onProgress: (event: Parameters<typeof compileProgressLine>[0]) =>
      render([compileProgressLine(event)]),
  };

  if (alias) {
    const result = await compileByAlias({ ...input, alias, expertsDir: config.expertsDir });

    render(compiledOneLines(result.alias, result.warnings));

    if (watch) logger.warn("--watch is not supported with --alias, ignoring");

    return;
  }

  const { compiled } = await compileExperts(input);

  render([compiledCount(compiled)]);

  if (!watch) return;

  watchAndCompile({
    ...input,
    sources: config.sources,
    onWatch: (dir) => render([watchingLine(dir)]),
    onRecompile: (filename) => render([recompilingLine(filename)]),
    onError: (message) => logger.error(message),
  });
};

export default compileProject;
