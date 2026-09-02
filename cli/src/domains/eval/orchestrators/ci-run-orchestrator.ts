import { runEvalOrchestrator } from "@/domains/eval/orchestrators/run-eval-orchestrator.js";
import { prepareOrchestrator } from "@/domains/workspace/prepare-orchestrator.js";

/**
 * What `praxis eval ci` does: the same full run, framed for CI.
 *
 * A separate file rather than a second export from run-eval, so that the
 * command it serves is findable from its name.
 */
export default prepareOrchestrator(runEvalOrchestrator, { ci: true });
