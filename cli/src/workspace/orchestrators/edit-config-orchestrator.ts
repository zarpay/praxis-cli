import type { Orchestrator } from "@/workspace/types.js";

import { spawnSync } from "node:child_process";

import { prepareOrchestrator } from "@/workspace/prepare-orchestrator.js";

/**
 * Opens the project config in the author's editor.
 *
 * `VISUAL`, then `EDITOR`, then `vi` — the conventional order, so the
 * command respects whatever a shell is already configured for. Runs
 * with inherited stdio, because a terminal editor needs the terminal.
 *
 * @throws when the editor could not be started at all
 */
export const editConfigOrchestrator: Orchestrator = async (ctx) => {
  const editor = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
  const result = spawnSync(editor, [ctx.paths.configFile], { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }
};

export default prepareOrchestrator(editConfigOrchestrator);
