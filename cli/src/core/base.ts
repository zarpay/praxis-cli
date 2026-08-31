import type { PraxisBaseOptions, PraxisProjectBaseOptions } from "@/types.js";

import { PraxisConfig } from "@/core/config.js";
import { Display, Logger } from "@/core/logger.js";

/**
 * Shared plumbing for Praxis classes: `out` renders the command's
 * stdout output (Display), `logger` carries stderr diagnostics.
 *
 * Both are injectable for tests and default to fresh instances.
 * Classes that operate on a project extend {@link PraxisProjectBase}
 * instead.
 */
export abstract class PraxisBase {
  /** Stdout output renderer for user-facing results. */
  protected readonly out: Display;
  /** Stderr logger for diagnostics. */
  protected readonly logger: Logger;

  constructor({ logger, out }: PraxisBaseOptions = {}) {
    this.logger = logger ?? new Logger();
    this.out = out ?? new Display();
  }
}

/**
 * Base for classes bound to a Praxis project.
 *
 * Adds the project `root` and a `config` that resolves lazily from it
 * on first access — construction stays free of filesystem work, and an
 * injected config (tests, callers that already loaded one) is used
 * as-is.
 */
export abstract class PraxisProjectBase extends PraxisBase {
  /** Project root all paths resolve against. */
  protected readonly root: string;

  private resolvedConfig?: PraxisConfig;

  constructor({ root, config, logger }: PraxisProjectBaseOptions) {
    super({ logger });
    this.root = root;
    this.resolvedConfig = config;
  }

  /** The project's config, loaded from `.praxis/config.json` on first access. */
  protected get config(): PraxisConfig {
    return (this.resolvedConfig ??= new PraxisConfig(this.root));
  }
}
