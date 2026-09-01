import type { PraxisBaseOptions } from "@/types.js";

import { Display } from "@/views/display.js";
import { Logger } from "@/views/logger.js";

/**
 * Shared plumbing for Praxis classes: `out` renders the command's
 * stdout output (Display), `logger` carries stderr diagnostics.
 *
 * Both are injectable for tests and default to fresh instances.
 * Classes bound to a project extend `PraxisProjectBase`
 * (`commands/base.ts`) instead, which adds the root and config — that
 * lives with the commands because they are its only subclasses, and it
 * would otherwise make the kernel depend on the workspace domain.
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
