import type { CommandRegistrar } from "@/types.js";

import { prepareAction } from "@/commands/action.js";
import addDocument from "@/domains/spec/orchestrators/add-document.js";

// One orchestrator, two subcommands: the type is what tells them apart.
const expert = prepareAction(addDocument, { type: "expert" });
const practice = prepareAction(addDocument, { type: "practice" });

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
    .action(expert);

  add
    .command("practice <name>")
    .description("Create a new practice from the template the compiler expects")
    .action(practice);
};

export default command;
