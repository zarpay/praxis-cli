import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import addDocument from "@/domains/spec/orchestrators/add-document.js";

/**
 * Registers the `praxis add` command group.
 *
 * Creates new experts and practices from the templates the compiler
 * expects, so an author starts from the right shape.
 */
export default function registerAddCommand(program: Command): void {
  const add = program.command("add").description("Add new content from templates");

  add
    .command("expert <name>")
    .description("Create a new expert from template")
    .action((name: string) => runAction((ctx) => addDocument(ctx, { type: "expert", name })));

  add
    .command("practice <name>")
    .description("Create a new practice from template")
    .action((name: string) => runAction((ctx) => addDocument(ctx, { type: "practice", name })));
}
