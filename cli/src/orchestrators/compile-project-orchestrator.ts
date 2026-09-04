import type { CompileProgress } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import compileExpertService from "@/services/compile-expert-service.js";
import compileExpertsService from "@/services/compile-experts-service.js";
import resolvePluginsService from "@/services/resolve-plugins-service.js";
import watchAndCompileService from "@/services/watch-and-compile-service.js";
import { ExpertStore } from "@/stores/expert-store.js";
import compileProgressView from "@/views/compile-progress-view.js";
import compileResultView from "@/views/compile-result-view.js";
import watchView from "@/views/watch-view.js";

/** How `praxis compile` was invoked. */
interface CompileProjectOptions {
  /** Compile only the expert with this alias. */
  alias?: string;
  /** Keep running, recompiling on every source change. */
  watch?: boolean;
}

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
  const { logger } = ctx;
  const cfg = ctx.config;

  // Plugins are constructed once per invocation, not per expert: the
  // Claude Code plugin writes its manifest on first compile and must not
  // repeat it for every agent.
  const onProgress = (event: CompileProgress) => {
    const progressView = compileProgressView(event);
    ctx.render(progressView);
  };
  const input = {
    plugins: resolvePluginsService(cfg, { logger }),
    onProgress,
  };

  // When an alias is given, compile only that expert and skip the watch mode.
  // Otherwise, compile every expert and optionally watch for changes.
  if (alias) {
    const store = new ExpertStore(cfg);
    const expert = store.byAlias(alias);

    if (!expert) {
      throw errors.expertNotFound(alias);
    }

    const result = await compileExpertService(cfg, {
      plugins: input.plugins,
      expertFile: expert.path,
    });

    const view = compileResultView(result);
    ctx.render(view);

    if (watch) logger.warn("--watch is not supported with --alias, ignoring");

    return "ok";
  }

  const { compiled } = await compileExpertsService(cfg, input);

  const view = compileResultView({ compiled });
  ctx.render(view);

  // If watch mode is not requested, the job is done. Otherwise, start watching
  // the experts directory and recompile on changes.
  if (!watch) return "ok";

  // The watch service is a long-running process that never returns, so the
  // orchestrator must not return either. It will render progress events as
  // they happen, and the user can terminate it with Ctrl+C.
  const onWatch = (dir: string) => {
    const view = watchView({ kind: "watching", dir });
    ctx.render(view);
  };

  // The recompile event is emitted when a file change is detected and the
  // compile service is about to re-run. It is not emitted for every file
  // change, only when a recompile is actually triggered.
  const onRecompile = (filename: string | null) => {
    const view = watchView({ kind: "recompiling", filename });
    ctx.render(view);
  };

  watchAndCompileService(cfg, {
    ...input,
    onWatch,
    onRecompile,
    onError: (message: string) => logger.error(message),
  });

  return "ok";
};

export default prepareOrchestrator(compileProjectOrchestrator);
