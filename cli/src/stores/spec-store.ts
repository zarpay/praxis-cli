import type { PraxisConfig } from "@/models/praxis-config.js";
import type { SpecFile as SpecFileType } from "@/models/spec-file.js";

import fg from "fast-glob";

import { errors } from "@/helpers/errors-helper.js";
import { exists, hasGlobChars, readText } from "@/helpers/files-helper.js";
import { joinPath, parentDir, resolvePath } from "@/helpers/paths-helper.js";
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
  private readonly sources: string[];
  private readonly specFilePattern: string;

  constructor(cfg: PraxisConfig) {
    this.root = cfg.root;
    this.sources = cfg.sources;
    this.specFilePattern = cfg.specFilePattern;
  }

  /**
   * The spec file governing a target, by directory siblinghood: the
   * pattern matched in the target's own directory. A file never governs
   * itself: a target that is itself a spec (the root README, say) must
   * not be reviewed against its own text, so the target is excluded
   * from the match.
   *
   * @throws PraxisError when the directory holds no matching spec
   */
  governingPath(targetPath: string): string {
    const baseDir = parentDir(targetPath);
    const target = resolvePath(targetPath);

    if (!hasGlobChars(this.specFilePattern)) {
      const specPath = joinPath(baseDir, this.specFilePattern);

      if (exists(specPath) && resolvePath(specPath) !== target) return specPath;

      throw errors.specNotFound(this.specFilePattern, baseDir, targetPath);
    }

    const matches = fg.sync(this.specFilePattern, {
      cwd: baseDir,
      onlyFiles: true,
      absolute: true,
    });

    const governing = matches.find((match) => resolvePath(match) !== target);

    if (governing !== undefined) return governing;

    throw errors.specPatternNotFound(this.specFilePattern, baseDir, targetPath);
  }

  /**
   * Reads and validates one spec.
   *
   * @throws PraxisError when the frontmatter is malformed
   */
  read(specPath: string): SpecFileType {
    const content = readText(specPath);

    return SpecFile.fromContent(content, specPath, this.root);
  }

  /** Every spec file under the source directories, absolute paths. */
  files(): string[] {
    return this.sources.flatMap((source) =>
      fg.sync(`**/${this.specFilePattern}`, {
        cwd: joinPath(this.root, source),
        onlyFiles: true,
        absolute: true,
        dot: true,
      }),
    );
  }
}
