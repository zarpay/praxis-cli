import type { PraxisBaseOptions } from "@/types.js";

import { Display } from "@/views/display.js";
import { Logger } from "@/views/logger.js";

/**
 * Shared plumbing for Praxis classes: `out` renders the command's
 * stdout output (Display), `logger` carries stderr diagnostics.
 *
 * Both are injectable for tests and default to fresh instances.
 *
 * Only the two eval classes that render still extend it. A command
 * constructs `Display` and `Logger` directly, because a route has no
 * state to share.
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
