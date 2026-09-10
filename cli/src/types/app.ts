// The application's layer signatures: what a command calls and what
// that delegates to. The framework's generic shapes live in
// `@framework/types.js`; these bind them to praxis.

import type { CommandContext } from "@/models/command-context.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type { NoOptions, Orchestrator as BaseOrchestrator } from "@framework/types.js";

/**
 * An orchestrator in this application: the framework's signature with
 * Praxis's context bound in, so a caller writes `Orchestrator<Options>`
 * and never repeats the context type.
 */
export type Orchestrator<Options = NoOptions> = BaseOrchestrator<CommandContext, Options>;

/**
 * A service in this application: the project's config first — the one
 * scope object every layer may hold — then the work's own input. One
 * call shape across every service, mirroring `Orchestrator`; a service
 * with no input of its own is still called with `{}`, and one that
 * reads no project facts names its first parameter `_cfg`.
 */
export type Service<In, Out> = (cfg: PraxisConfig, input: In) => Out;

/** The input of a service that needs nothing beyond the config. */
export type NoInput = NoOptions;
