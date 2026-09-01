import { CommandContext } from "@/domains/workspace/models/command-context.js";

/**
 * Wraps a CLI action body with the two things every command shares: the
 * context its orchestrator needs, and one error policy.
 *
 * This is the composition root. Building the context here — at action
 * dispatch, never at import time — is what lets a command hold no models
 * of its own: it registers options, hands them to an orchestrator with
 * the context, and renders what comes back.
 *
 * A thrown error logs to stderr and exits 1. A returned number becomes
 * the exit code; returning nothing lets the process exit naturally
 * (respecting any process.exitCode the body set).
 */
export async function runAction(
  body: (ctx: CommandContext) => Promise<number | void> | number | void,
): Promise<void> {
  const ctx = new CommandContext();

  try {
    const code = await body(ctx);

    if (typeof code === "number") process.exit(code);
  } catch (err) {
    ctx.logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
