import type { CommandContext } from "@/models/command-context.js";
import type { RawConfig } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists, readJson, writeJson } from "@/helpers/files-helper.js";
import { configFile } from "@/models/project-paths.js";
import { CLI_VERSION } from "@/version.js";

/**
 * Enforces the project's praxis version pin, before any command runs.
 *
 * Praxis is installed globally rather than declared in a package.json,
 * so nothing else stops two teammates running different versions
 * against one committed cache and ledger — and a version change can be
 * an epoch. The config pins the version; every dispatch checks it:
 *
 * - No project, or no config file yet (`praxis init`): nothing to check.
 * - Pin matches this binary: silence.
 * - No pin: adopt — warn and write this binary's version into the
 *   config, so the project pins from its next commit on.
 * - Pin conflicts: refuse with the two ways out (install the pinned
 *   version, or move the pin). A usage/config error — exit 2.
 */
export function enforceVersionPin(ctx: CommandContext): void {
  const configPath = existingConfigPath(ctx);

  if (configPath === null) return;

  const pinned = ctx.config.version;

  if (pinned === CLI_VERSION) return;

  if (pinned === null) {
    adoptVersion(configPath, ctx);

    return;
  }

  throw errors.versionConflict(pinned, CLI_VERSION);
}

/** The project's config file, or null when there is no project or file. */
function existingConfigPath(ctx: CommandContext): string | null {
  try {
    const path = configFile(ctx.root);

    return exists(path) ? path : null;
  } catch {
    // No project root: bare `praxis` and `praxis init` own that story.
    return null;
  }
}

/** Writes this binary's version into a config that pins none, and says so. */
function adoptVersion(configPath: string, ctx: CommandContext): void {
  const raw = readJson<RawConfig>(configPath);

  writeJson(configPath, { version: CLI_VERSION, ...raw });
  ctx.logger.warn(
    `.praxis/config.json pins no praxis version — adopting ${CLI_VERSION}. ` +
      `Commit the change; teammates must run the same version.`,
  );
}
