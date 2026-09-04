import type { CommandRegistrar } from "@framework/types.js";

import addExpertOrchestrator from "@/orchestrators/add-expert-orchestrator.js";
import addPracticeOrchestrator from "@/orchestrators/add-practice-orchestrator.js";

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
    .addHelpText(
      "after",
      `
When to use: starting a new code-owner document. Scaffolds into the
configured expertsDir with the frontmatter the compiler and the eval
layer honor (validates:, excludes:, exemplars:, practices:).

Example:
  $ praxis add expert service-steward`,
    )
    .action(addExpertOrchestrator);

  add
    .command("practice <name>")
    .description("Create a new practice from the template the compiler expects")
    .addHelpText(
      "after",
      `
When to use: capturing a reusable review or authoring procedure that
experts reference from their practices: list.

Example:
  $ praxis add practice review-service-quality`,
    )
    .action(addPracticeOrchestrator);
};

export default addCommand;
