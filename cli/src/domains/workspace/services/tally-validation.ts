import type { StatusReport, TallyValidationInput } from "@/domains/workspace/types.js";

import { joinPath } from "@/core/paths.js";
import { cacheIdentity } from "@/domains/eval/services/judge-hash.js";
import listTargetPaths from "@/domains/eval/services/list-target-paths.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";

/**
 * Counts each judge's cached verdicts across every spec target.
 *
 * Reads only: no API keys, no judging. The targets come from the eval
 * layer's own discovery, so coverage counts what a run would actually
 * judge rather than a second guess at it — a file with no cached
 * verdict is "not validated", which is the number that tells you a run
 * is overdue.
 *
 * One row per judge, never pooled: judges are separate instruments, and
 * averaging them would hide exactly the disagreement worth seeing.
 */
export default function tallyValidation({
  root,
  config,
}: TallyValidationInput): StatusReport["validation"] {
  const targets = listTargetPaths({
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore: config.ignore.map((p) => joinPath(root, p)),
  });

  // One cache namespace per judge; the un-namespaced cache when no
  // judges are configured at all.
  const readers =
    config.judges.length > 0
      ? config.judges.map((judge) => ({
          judge: judge.name,
          manager: new CacheManager({ projectRoot: root, judge: cacheIdentity(judge) }),
        }))
      : [{ judge: null, manager: new CacheManager({ projectRoot: root }) }];

  return readers.map(({ judge, manager }) => {
    const row = {
      judge,
      pass: 0,
      warn: 0,
      fail: 0,
      notValidated: 0,
    };

    for (const targetPath of targets) {
      const cached = manager.readRaw({ targetPath });

      if (!cached) {
        row.notValidated++;
      } else if (cached.result.compliant) {
        row.pass++;
      } else if (cached.result.severity === "warning") {
        row.warn++;
      } else {
        row.fail++;
      }
    }

    return row;
  });
}
