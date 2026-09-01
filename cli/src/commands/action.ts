import type { CommandOutcome } from "@/types.js";

import { CommandContext } from "@/domains/workspace/models/command-context.js";

/**
 * Wraps a CLI action with the two things every command shares: the
 * context its orchestrator needs, and one error policy.
 *
 * This is the composition root. Building the context here — at action
 * dispatch, never at import time — is what lets a command hold nothing of
 * its own: it declares its options, hands them to one orchestrator, and
 * is done. The orchestrator owns the response, rendering included.
 *
 * The body returns an outcome, not a payload. "failed" exits 1 — a
 * legitimate non-zero result, like issues found or verdicts failed. A
 * genuine error is thrown instead: it logs to stderr and also exits 1.
 *
 * Every orchestrator is async, so there is one shape here to await rather
 * than a union of sync and async ones.
 */
export async function runAction(
  body: (ctx: CommandContext) => Promise<CommandOutcome | void>,
): Promise<void> {
  const ctx = new CommandContext();

  try {
    const outcome = await body(ctx);

    if (outcome === "failed") process.exit(1);
  } catch (err) {
    ctx.logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
