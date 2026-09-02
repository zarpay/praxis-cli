import { Writable } from "node:stream";

import { Logger } from "@framework/views/logger.js";

/**
 * Creates a Logger whose output is captured in memory instead of stderr.
 *
 * Used by tests that assert on log messages. Color is disabled so
 * assertions can match plain text without ANSI escape codes.
 *
 * @returns `logger` (the capturing Logger), `output` (returns everything
 *   logged so far), and `clear` (resets the captured text)
 */
export function createCaptureLogger(): {
  logger: Logger;
  output: () => string;
  clear: () => void;
} {
  let captured = "";

  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      captured += String(chunk);
      callback();
    },
  });

  return {
    logger: new Logger({ output: stream, color: false }),
    output: () => captured,
    clear: () => {
      captured = "";
    },
  };
}
