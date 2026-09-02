import type { Orchestrator } from "@/workspace/types.js";

import { prepareOrchestrator as prepare } from "@/framework/prepare-orchestrator.js";
import { CommandContext } from "@/workspace/models/command-context.js";

/**
 * The framework's `prepareOrchestrator`, bound to Praxis's context.
 *
 * This is the composition root: the one place that decides a Praxis
 * command runs against a `CommandContext`. Everything else about
 * preparing an action — deriving options from commander, the error
 * policy, the exit code — is generic and lives in the framework.
 */
export function prepareOrchestrator<Options>(
  orchestrator: Orchestrator<Options>,
  extra: Partial<Options> = {},
): (...args: unknown[]) => Promise<void> {
  return prepare(() => new CommandContext(), orchestrator, extra);
}
