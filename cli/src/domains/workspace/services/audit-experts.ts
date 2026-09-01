import type { RefKey } from "@/domains/spec/types.js";
import type { ExpertAudit, StatusReport } from "@/domains/workspace/types.js";

import { exists } from "@/core/files.js";
import { baseName, joinPath, relativePath } from "@/core/paths.js";
import { ExpertFile } from "@/domains/spec/models/expert-file.js";
import { GlobExpander } from "@/domains/spec/services/glob-expander.js";
import { DocumentFile } from "@/domains/workspace/models/document-file.js";

/** The reference keys an expert can point at other documents with. */
const REF_KEYS: readonly RefKey[] = ["practices", "context", "refs"];

/**
 * Checks the cross-references between experts and the documents they
 * point at.
 *
 * One pass over the expert files answers every structural question at
 * once — which aliases exist, which practices are actually referenced,
 * which references dangle, which globs match nothing — because each
 * answer needs the same parse of the same files.
 *
 * A document that fails to parse is reported, never fatal: project
 * health is exactly the report you want when a document is broken.
 */
export class ExpertAuditor {
  private readonly root: string;
  private readonly globExpander: GlobExpander;

  constructor({ root, specFilePattern }: { root: string; specFilePattern: string }) {
    this.root = root;
    this.globExpander = new GlobExpander(root, specFilePattern);
  }

  /** Audits every expert file in one pass. */
  async audit(expertFiles: string[]): Promise<ExpertAudit> {
    const audit: ExpertAudit = {
      aliases: new Map<string, string>(),
      referencedPractices: new Set<string>(),
      invalidExperts: [],
      danglingRefs: [],
      zeroMatchGlobs: [],
      missingDescriptions: [],
    };

    for (const expertFile of expertFiles) {
      const expertName = baseName(expertFile);
      const expert = readExpert(expertFile);

      if (!(expert instanceof ExpertFile)) {
        audit.invalidExperts.push({ expert: expertName, reason: expert.reason });
        continue;
      }

      audit.aliases.set(expert.alias.toLowerCase(), expertName);

      if (!expert.description) {
        audit.missingDescriptions.push(expertName);
      }

      for (const key of REF_KEYS) {
        await this.checkRefs(expert, key, expertName, audit);
      }
    }

    return audit;
  }

  /** Practices no expert references, by basename. */
  findOrphanedPractices(practiceFiles: string[], referenced: Set<string>): string[] {
    return practiceFiles
      .filter((file) => !referenced.has(relativePath(this.root, file)))
      .map((file) => baseName(file));
  }

  /** Practices whose `owner:` matches no expert alias. */
  findUnmatchedOwners(
    practiceFiles: string[],
    aliases: Map<string, string>,
  ): StatusReport["unmatchedOwners"] {
    const unmatched: StatusReport["unmatchedOwners"] = [];

    for (const practiceFile of practiceFiles) {
      const owner = DocumentFile.at(practiceFile).owner;

      if (owner && !aliases.has(owner.toLowerCase())) {
        unmatched.push({ practice: baseName(practiceFile), owner });
      }
    }

    return unmatched;
  }

  /**
   * Records what one reference key points at.
   *
   * A glob that matches nothing is a typo worth reporting; a plain path
   * that does not exist is a dangling reference. Both kinds contribute
   * their matches to the referenced-practices set, which is what makes
   * orphan detection accurate.
   */
  private async checkRefs(
    expert: ExpertFile,
    key: RefKey,
    expertName: string,
    audit: ExpertAudit,
  ): Promise<void> {
    for (const pattern of expert.refs(key)) {
      if (this.globExpander.isGlob(pattern)) {
        const matches = await this.globExpander.expand(pattern);

        if (matches.length === 0) {
          audit.zeroMatchGlobs.push({ expert: expertName, pattern });
        }

        if (key === "practices") {
          for (const match of matches) audit.referencedPractices.add(match);
        }

        continue;
      }

      if (!exists(joinPath(this.root, pattern))) {
        audit.danglingRefs.push({ expert: expertName, ref: pattern });
      }

      if (key === "practices") {
        audit.referencedPractices.add(pattern);
      }
    }
  }
}

/** Reads an expert, returning the parse failure rather than raising it. */
function readExpert(expertFile: string): ExpertFile | { reason: string } {
  try {
    return ExpertFile.at(expertFile);
  } catch (err) {
    return { reason: err instanceof Error ? err.message : String(err) };
  }
}
