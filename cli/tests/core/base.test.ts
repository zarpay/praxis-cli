import { describe, expect, it } from "vitest";

import { PraxisBase } from "@/core/base.js";
import { Display } from "@/views/display.js";
import { Logger } from "@/views/logger.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";

/** Minimal subclass exposing the protected plumbing for assertions. */
class Plain extends PraxisBase {
  get plumbing(): { out: Display; logger: Logger } {
    return { out: this.out, logger: this.logger };
  }
}

/** Minimal project-bound subclass exposing root and config. */

describe("PraxisBase", () => {
  it("provides a Display and a Logger by default", () => {
    const plumbing = new Plain().plumbing;

    expect(plumbing.out).toBeInstanceOf(Display);
    expect(plumbing.logger).toBeInstanceOf(Logger);
  });

  it("uses an injected logger", () => {
    const { logger, output } = createCaptureLogger();

    new Plain({ logger }).plumbing.logger.info("captured");

    expect(output()).toContain("captured");
  });
});
