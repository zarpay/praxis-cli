import type { CommandContextOptions } from "@/domains/workspace/types.js";

import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { Logger } from "@/views/logger.js";

/**
 * What every orchestrator is handed: the project it acts on, and the
 * diagnostic channel it may speak on.
 *
 * This is the plumbing `PraxisBase` used to hand to a class, rebuilt for
 * a layer that is now functions. It carries what an orchestrator needs to
 * do work — root, paths, config — and a logger for diagnostics. It does
 * not carry `Display`: a command's *output* still comes back as a result
 * or arrives through `onProgress`, and a view decides what it looks like.
 *
 * `root` and `config` resolve lazily and are cached. `praxis init` runs
 * before a `.praxis/` directory exists, so a context must be constructible
 * where asking for its root would throw.
 */
export class CommandContext {
  readonly paths: Paths;

  readonly logger: Logger;

  private cachedConfig?: PraxisConfig;

  constructor({ paths, logger }: CommandContextOptions = {}) {
    this.paths = paths ?? new Paths();
    this.logger = logger ?? new Logger();
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
