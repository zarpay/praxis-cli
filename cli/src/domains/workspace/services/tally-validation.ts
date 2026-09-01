import type { PraxisConfig } from "@/core/config.js";
import type { StatusReport } from "@/domains/workspace/types.js";

import { EvalRun } from "@/domains/eval/orchestrators/eval-run.js";
import { cacheIdentity } from "@/domains/eval/services/judge-hash.js";
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
export function tallyValidation(root: string, config: PraxisConfig): StatusReport["validation"] {
  const targets = EvalRun.forProject(root, config).listTargetFiles();

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
    } as StatusReport["validation"][number];

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
