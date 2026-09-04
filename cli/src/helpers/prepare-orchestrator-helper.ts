import type { Orchestrator } from "@/types.js";

import { PraxisError, USAGE_ERROR_CODES } from "@/helpers/errors-helper.js";
import { CommandContext } from "@/models/command-context.js";
import { prepareOrchestrator as prepare } from "@framework/prepare-orchestrator.js";

/**
 * The framework's `prepareOrchestrator`, bound to Praxis's context.
 *
 * This is the composition root: the one place that decides a Praxis
 * command runs against a `CommandContext`, and the one place Praxis's
 * error classification meets the framework's exit policy (09-o): a
 * usage or configuration error exits 2, everything else thrown exits 1
 * alongside genuine violations.
 */
export function prepareOrchestrator<Options>(
  orchestrator: Orchestrator<Options>,
  extra: Partial<Options> = {},
): (...args: unknown[]) => Promise<void> {
  return prepare(() => new CommandContext(), orchestrator, extra, exitCodeFor);
}

/** 2 for usage/config mistakes, 1 for everything else (09-o). */
function exitCodeFor(err: unknown): number {
  if (err instanceof PraxisError && USAGE_ERROR_CODES.has(err.code)) return 2;

  return 1;
}
