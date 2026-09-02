import type { CommandOutcome } from "@/types.js";

import { CommandContext } from "@/domains/workspace/models/command-context.js";

/**
 * Prepares a commander action handler.
 *
 * This is the composition root, and it returns the callback rather than
 * being called from inside one: `.action(handle(...))` instead of
 * `.action((...args) => runAction(() => ...))`. The command's parsed
 * arguments arrive in the same parameter list as the context, so there is
 * one closure per command rather than two.
 *
 * The context is built per dispatch — never at import time — and the
 * handler applies the one error policy every command shares. The body
 * returns an outcome, not a payload: "failed" exits 1, a legitimate
 * non-zero result like issues found. A genuine error is thrown instead;
 * it logs to stderr and also exits 1.
 */
export function handle<Args extends unknown[]>(
  body: (ctx: CommandContext, ...args: Args) => Promise<CommandOutcome | void>,
): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    const ctx = new CommandContext();

    try {
      if ((await body(ctx, ...args)) === "failed") process.exit(1);
    } catch (err) {
      ctx.logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  };
}
