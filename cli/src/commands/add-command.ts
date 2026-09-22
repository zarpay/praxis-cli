import type { CommandRegistrar } from "@framework/types.js";

import addExpertHelp from "@/help/add-expert-help.md";
import addHelp from "@/help/add-help.md";
import addPracticeHelp from "@/help/add-practice-help.md";
import addExpertOrchestrator from "@/orchestrators/add-expert-orchestrator.js";
import addPracticeOrchestrator from "@/orchestrators/add-practice-orchestrator.js";

/**
 * Registers the `praxis add` command group.
 *
 * Creates new experts and practices from the templates the compiler
 * expects, so an author starts from the right shape.
 */
const addCommand: CommandRegistrar = (program) => {
  const add = program
    .command("add")
    .description("Add new content from templates")
    .addHelpText("after", `\n${addHelp}`);

  add
    .command("expert <name>")
    .description("Create a new expert from the template the compiler expects")
    .addHelpText("after", `\n${addExpertHelp}`)
    .action(addExpertOrchestrator);

  add
    .command("practice <name>")
    .description("Create a new practice from the template the compiler expects")
    .addHelpText("after", `\n${addPracticeHelp}`)
    .action(addPracticeOrchestrator);
};

export default addCommand;
