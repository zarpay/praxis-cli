import { Logger } from "@/core/logger.js";

/**
 * Wraps a CLI action body with the one error policy every command
 * shares: a thrown error logs to stderr and exits 1. A returned number
 * becomes the exit code; returning nothing lets the process exit
 * naturally (respecting any process.exitCode the body set).
 */
export async function runAction(body: () => Promise<number | void> | number | void): Promise<void> {
  try {
    const code = await body();

    if (typeof code === "number") process.exit(code);
  } catch (err) {
    new Logger().error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
