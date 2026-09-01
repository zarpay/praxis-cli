import type { Command } from "commander";

import type { AddableType } from "@/domains/workspace/types.js";

import { runAction } from "@/commands/action.js";
import addDocument from "@/domains/spec/orchestrators/add-document.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { renderReport } from "@/views/report.js";

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
    .action((name: string) => runAdd("expert", name));

  add
    .command("practice <name>")
    .description("Create a new practice from template")
    .action((name: string) => runAdd("practice", name));
}

/** Adds one document and reports where it landed. */
function runAdd(type: AddableType, name: string): Promise<void> {
  return runAction(() => {
    const root = new Paths().root;
    const config = new PraxisConfig(root);

    const created = addDocument({
      type,
      name,
      root,
      expertsDir: config.expertsDir,
      practicesDir: config.practicesDir,
    });

    renderReport([{ channel: "success", text: `Created ${created.type}: ${created.path}` }]);
  });
}
