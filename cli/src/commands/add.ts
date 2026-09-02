import type { CommandRegistrar } from "@/types.js";

import { handle } from "@/commands/action.js";
import addDocument from "@/domains/spec/orchestrators/add-document.js";

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
    .description("Create a new expert from template")
    .action(handle(addDocument, { type: "expert" }));

  add
    .command("practice <name>")
    .description("Create a new practice from template")
    .action(handle(addDocument, { type: "practice" }));
};

export default command;
