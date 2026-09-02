import type { Logger } from "@/framework/views/logger.js";

import { CommandContext } from "@/domains/workspace/models/command-context.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";

/**
 * A CommandContext bound to a throwaway project root.
 *
 * The tmpdir helpers all write a `.praxis/` marker, so `Paths` resolves
 * the root from it exactly as it would in a real project.
 */
export function testContext(root: string, logger?: Logger): CommandContext {
  return new CommandContext({ paths: new Paths(root), logger });
}
