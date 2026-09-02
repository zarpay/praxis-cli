import type { CommandRegistrar } from "@/types.js";

import { addExpert, addPractice } from "@/domains/spec/orchestrators/add-document.js";

/**
 * Registers the `praxis add` command group.
 *
 * Creates new experts and practices from the templates the compiler
 * expects, so an author starts from the right shape.
 */
const command: CommandRegistrar = (program) => {
  const add = program.command("add").description("Add new content from templates");

  add
    .command("expert <name>")
    .description("Create a new expert from the template the compiler expects")
    .action(addExpert);

  add
    .command("practice <name>")
    .description("Create a new practice from the template the compiler expects")
    .action(addPractice);
};

export default command;
