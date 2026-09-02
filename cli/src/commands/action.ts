import type { Command } from "commander";

import type { Orchestrator } from "@/domains/workspace/types.js";

import { CommandContext } from "@/domains/workspace/models/command-context.js";

/**
 * Prepares a commander action handler that runs one orchestrator.
 *
 * Both sides of this have a fixed shape — commander parses into named
 * arguments and options, an orchestrator takes `(ctx, options)` — so the
 * mapping between them is derived rather than written out per command.
 * Commander knows its own argument names (`registeredArguments`) and its
 * parsed options (`opts()`), which together are the options object:
 * `praxis eval verdict <target> --verbose` yields `{ target, verbose }`.
 *
 * `extra` supplies what the CLI surface cannot: a literal that
 * distinguishes two commands sharing one orchestrator, like
 * `{ type: "expert" }` or `{ ci: true }`. It is type-checked; the derived
 * half is not, so an option renamed here and not in the orchestrator's
 * `Options` is caught by the tests and the demo run, not the compiler.
 *
 * This is also the composition root: the context is built per dispatch,
 * never at import time, and the one error policy lives here. "failed"
 * exits 1 — a legitimate non-zero result like issues found. A genuine
 * error is thrown instead; it logs to stderr and also exits 1.
 */
export function handle<Options>(
  orchestrator: Orchestrator<Options>,
  extra: Partial<Options> = {},
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    const command = args.at(-1) as Command;
    const named = command.registeredArguments.map((arg, index) => [
      camelCase(arg.name()),
      args[index],
    ]);
    const options = {
      ...command.opts(),
      ...Object.fromEntries(named),
      ...extra,
    } as Options;

    const ctx = new CommandContext();

    try {
      if ((await orchestrator(ctx, options)) === "failed") process.exit(1);
    } catch (err) {
      ctx.logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  };
}

/** `some-thing` → `someThing`, matching how commander names its options. */
function camelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
