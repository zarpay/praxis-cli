import chalk from "chalk";
import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Logger } from "@framework/views/logger.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";

describe("Logger", () => {
  describe("log levels", () => {
    it("prefixes info messages with [INFO]", () => {
      const { logger, output } = createCaptureLogger();
      logger.info("hello");
      expect(output()).toBe("[INFO] hello\n");
    });

    it("prefixes success messages with [OK]", () => {
      const { logger, output } = createCaptureLogger();
      logger.success("done");
      expect(output()).toBe("[OK] done\n");
    });

    it("prefixes warning messages with [WARN]", () => {
      const { logger, output } = createCaptureLogger();
      logger.warn("careful");
      expect(output()).toBe("[WARN] careful\n");
    });

    it("prefixes error messages with [ERROR]", () => {
      const { logger, output } = createCaptureLogger();
      logger.error("boom");
      expect(output()).toBe("[ERROR] boom\n");
    });

    it("appends each message on its own line", () => {
      const { logger, output } = createCaptureLogger();
      logger.info("first");
      logger.warn("second");
      expect(output()).toBe("[INFO] first\n[WARN] second\n");
    });
  });

  describe("color detection", () => {
    let savedNoColor: string | undefined;

    beforeEach(() => {
      savedNoColor = process.env["NO_COLOR"];
      delete process.env["NO_COLOR"];
    });

    afterEach(() => {
      if (savedNoColor === undefined) {
        delete process.env["NO_COLOR"];
      } else {
        process.env["NO_COLOR"] = savedNoColor;
      }
    });

    /** Captures raw bytes so ANSI escape codes are observable. */
    function rawCapture(): { stream: Writable; output: () => string } {
      let captured = "";
      const stream = new Writable({
        write(chunk: Buffer | string, _encoding, callback) {
          captured += String(chunk);
          callback();
        },
      });
      return { stream, output: () => captured };
    }

    // Comparing against chalk's own output keeps these assertions exact
    // whether or not the test environment supports color: with color
    // enabled the label must be exactly what chalk produces, and with
    // color disabled it must be the bare label with no escape codes.

    it("colors the label via chalk when color is explicitly enabled", () => {
      const { stream, output } = rawCapture();
      const logger = new Logger({ output: stream, color: true });
      logger.info("colored");
      expect(output()).toBe(`${chalk.blue("[INFO]")} colored\n`);
    });

    it("emits plain text when color is explicitly disabled", () => {
      const { stream, output } = rawCapture();
      const logger = new Logger({ output: stream, color: false });
      logger.info("plain");
      expect(output()).toBe("[INFO] plain\n");
    });

    it("disables color for non-TTY streams by default", () => {
      const { stream, output } = rawCapture();
      const logger = new Logger({ output: stream });
      logger.info("piped");
      expect(output()).toBe("[INFO] piped\n");
    });

    it("disables color when NO_COLOR is set, even for TTY-like streams", () => {
      process.env["NO_COLOR"] = "1";
      const { stream, output } = rawCapture();
      // Simulate a TTY stream: detectColor checks the isTTY property.
      (stream as Writable & { isTTY: boolean }).isTTY = true;
      const logger = new Logger({ output: stream });
      logger.info("still plain");
      expect(output()).toBe("[INFO] still plain\n");
    });

    it("uses chalk labels for TTY streams when NO_COLOR is unset", () => {
      const { stream, output } = rawCapture();
      (stream as Writable & { isTTY: boolean }).isTTY = true;
      const logger = new Logger({ output: stream });
      logger.info("colored");
      expect(output()).toBe(`${chalk.blue("[INFO]")} colored\n`);
    });
  });
});
