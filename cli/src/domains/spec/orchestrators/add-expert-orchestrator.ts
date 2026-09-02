import { addDocumentOrchestrator } from "@/domains/spec/orchestrators/add-document-orchestrator.js";
import { prepareOrchestrator } from "@/domains/workspace/prepare-orchestrator.js";

/**
 * What `praxis add expert <name>` does: scaffold one expert from its
 * template.
 *
 * The type is the only thing separating this from its sibling, and it is
 * not something the CLI surface can supply, so it is bound here.
 */
export default prepareOrchestrator(addDocumentOrchestrator, { type: "expert" });
