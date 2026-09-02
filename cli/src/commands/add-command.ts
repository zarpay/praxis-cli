import type { CommandRegistrar } from "@/framework/types.js";

import addExpertOrchestrator from "@/domains/spec/orchestrators/add-expert-orchestrator.js";
import addPracticeOrchestrator from "@/domains/spec/orchestrators/add-practice-orchestrator.js";

/**
 * Registers the `praxis add` command group.
 *
 * Creates new experts and practices from the templates the compiler
 * expects, so an author starts from the right shape.
 */
const addCommand: CommandRegistrar = (program) => {
  const add = program.command("add").description("Add new content from templates");

  add
    .command("expert <name>")
    .description("Create a new expert from the template the compiler expects")
    .action(addExpertOrchestrator);

  add
    .command("practice <name>")
    .description("Create a new practice from the template the compiler expects")
    .action(addPracticeOrchestrator);
};

export default addCommand;
