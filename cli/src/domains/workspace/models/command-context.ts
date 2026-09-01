import type { CommandContextOptions } from "@/domains/workspace/types.js";

import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { Display } from "@/views/display.js";
import { Logger } from "@/views/logger.js";

/**
 * What every orchestrator is handed: the project it acts on, and the
 * diagnostic channel it may speak on.
 *
 * This is the plumbing `PraxisBase` used to hand to a class, rebuilt for
 * a layer that is now functions. It carries what an orchestrator needs to
 * do work — root, paths, config — and both output channels, because an
 * orchestrator owns its command's whole response: it renders the views
 * itself and hands the command back nothing but an outcome.
 *
 * `root` and `config` resolve lazily and are cached. `praxis init` runs
 * before a `.praxis/` directory exists, so a context must be constructible
 * where asking for its root would throw.
 */
export class CommandContext {
  readonly paths: Paths;

  readonly logger: Logger;

  readonly out: Display;

  private cachedConfig?: PraxisConfig;

  constructor({ paths, logger, out }: CommandContextOptions = {}) {
    this.paths = paths ?? new Paths();
    this.logger = logger ?? new Logger();
    this.out = out ?? new Display();
  }

  /** The project root — the directory holding `.praxis/`. */
  get root(): string {
    return this.paths.root;
  }

  /** The project's configuration, read once per context. */
  get config(): PraxisConfig {
    return (this.cachedConfig ??= new PraxisConfig(this.root));
  }
}
