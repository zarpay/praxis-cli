import type { PraxisProjectBaseOptions } from "@/types.js";

import { PraxisBase } from "@/core/base.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";

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
