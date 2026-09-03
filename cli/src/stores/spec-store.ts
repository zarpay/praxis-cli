import type { PraxisConfig } from "@/models/praxis-config.js";
import type { SpecFile as SpecFileType } from "@/models/spec-file.js";

import fg from "fast-glob";

import { errors } from "@/helpers/errors-helper.js";
import { exists, hasGlobChars, readText } from "@/helpers/files-helper.js";
import { joinPath, parentDir } from "@/helpers/paths-helper.js";
import { SpecFile } from "@/models/spec-file.js";

/**
 * The specs living in the user's tree: found by the configured
 * filename pattern, never written (10 — praxis reads specs, the
 * developer owns them).
 *
 * Unlike the `.praxis/` stores this one has no directory of its own —
 * its layout knowledge is the *pattern*: how a spec file is recognized,
 * how the one governing a target is located (directory siblinghood),
 * and how the source trees are swept. The document format is
 * `SpecFile`; this store owns the finding and the reading.
 */
export class SpecStore {
  private readonly root: string;
  private readonly specFilePattern: string;

  constructor(config: PraxisConfig) {
    this.root = config.root;
    this.specFilePattern = config.specFilePattern;
  }

  /**
   * The spec file governing a target, by directory siblinghood: the
   * pattern matched in the target's own directory.
   *
   * @throws PraxisError when the directory holds no matching spec
   */
  governingPath(targetPath: string): string {
    const baseDir = parentDir(targetPath);

    if (!hasGlobChars(this.specFilePattern)) {
      const specPath = joinPath(baseDir, this.specFilePattern);

      if (exists(specPath)) return specPath;

      throw errors.specNotFound(this.specFilePattern, baseDir, targetPath);
    }

    const matches = fg.sync(this.specFilePattern, {
      cwd: baseDir,
      onlyFiles: true,
      absolute: true,
    });

    if (matches.length > 0) return matches[0];

    throw errors.specPatternNotFound(this.specFilePattern, baseDir, targetPath);
  }

  /**
   * Reads and validates one spec.
   *
   * @throws PraxisError when the frontmatter is malformed
   */
  read(specPath: string): SpecFileType {
    return SpecFile.fromContent(readText(specPath), specPath, this.root);
  }

  /** Every spec file under the given source directories, absolute paths. */
  filesIn(sources: string[]): string[] {
    return sources.flatMap((source) =>
      fg.sync(`**/${this.specFilePattern}`, {
        cwd: joinPath(this.root, source),
        onlyFiles: true,
        absolute: true,
        dot: true,
      }),
    );
  }
}
