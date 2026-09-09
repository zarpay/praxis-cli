import type { Orchestrator } from "@/types.js";

import { spawnSync } from "node:child_process";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { Prompter } from "@framework/views/prompter.js";

/**
 * Opens the project config in the author's editor.
 *
 * `VISUAL`, then `EDITOR`, then `vi` — the conventional order, so the
 * command respects whatever a shell is already configured for. The value
 * is a command line, not a bare binary — `EDITOR="code --wait"` is
 * common — so it is split into command and arguments before spawning.
 * Runs with inherited stdio, because a terminal editor needs the
 * terminal.
 *
 * @throws PraxisError when there is no terminal for an editor to use,
 *   or the editor could not be started at all
 */
export const editConfigOrchestrator: Orchestrator = async (ctx) => {
  const prompter = new Prompter();

  if (!prompter.interactive) {
    throw errors.editorNeedsTty();
  }

  const editor = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
  const [command, ...editorArgs] = editor.split(/\s+/).filter(Boolean);
  const result = spawnSync(command, [...editorArgs, ctx.paths.configFile], { stdio: "inherit" });

  if (result.error) {
    throw errors.editorFailed(editor, result.error.message);
  }

  return "ok";
};

export default prepareOrchestrator(editConfigOrchestrator);
