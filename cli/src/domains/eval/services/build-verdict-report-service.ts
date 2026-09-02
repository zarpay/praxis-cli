import type { BuildVerdictReportInput, VerdictReport } from "@/domains/eval/types.js";

import fg from "fast-glob";

import { exists, hasGlobChars, readText } from "@/core/files.js";
import { joinPath, parentDir } from "@/core/paths.js";
import assistHashInput from "@/domains/eval/services/build-assist-hash-input-service.js";
import contentHash from "@/domains/eval/services/hash-content-service.js";
import resolveAssistInputs from "@/domains/eval/services/resolve-assist-inputs-service.js";

/**
 * Classifies a target's cached verdict, including whether it is stale.
 *
 * Staleness takes priority: when the recomputed content hash differs
 * from the cached one, the status is "stale" whatever the cached result
 * said, because that result described inputs that no longer exist. An
 * uncomputable hash — the target or its spec is gone — skips the check
 * rather than inventing an answer.
 *
 * This reads the target and its spec, which is why it is a service and
 * not a view: deciding *what happened* is work, rendering it is not.
 */
export default function buildVerdictReport({
  targetPath,
  cacheData,
  specFilePattern,
  root,
}: BuildVerdictReportInput): VerdictReport {
  const currentHash = recomputeHash({
    targetPath,
    specPath: cacheData?.document.spec_path,
    specFilePattern,
    root,
  });

  if (!cacheData) {
    return { targetPath, status: "not_validated", cacheData: null, currentHash, isStale: false };
  }

  if (currentHash !== null && cacheData.content_hash !== currentHash) {
    return { targetPath, status: "stale", cacheData, currentHash, isStale: true };
  }

  if (cacheData.result.compliant) {
    return { targetPath, status: "pass", cacheData, currentHash, isStale: false };
  }

  return {
    targetPath,
    status: cacheData.result.severity === "warning" ? "warn" : "fail",
    cacheData,
    currentHash,
    isStale: false,
  };
}

/**
 * The content hash the target would produce right now.
 *
 * Null when it cannot be computed — the target is gone, or its spec is
 * — because "unknown" and "changed" are different answers and only one
 * of them should mark a verdict stale.
 *
 * When the cache recorded which spec was used, that one is rehashed;
 * otherwise the spec is rediscovered the way a run would.
 */
function recomputeHash({
  targetPath,
  specPath,
  specFilePattern,
  root,
}: {
  targetPath: string;
  specPath?: string;
  specFilePattern: string;
  root?: string;
}): string | null {
  try {
    const targetContent = readText(targetPath);
    const resolvedSpec = specPath ?? findSpec(targetPath, specFilePattern);

    if (!resolvedSpec || !exists(resolvedSpec)) return null;

    const specContent = readText(resolvedSpec);
    const assist = resolveAssistInputs({ specContent, specPath: resolvedSpec, root });

    return contentHash(targetContent, specContent, assistHashInput(assist));
  } catch {
    return null;
  }
}

/** The spec governing a target's directory, or null when there is none. */
function findSpec(targetPath: string, specFilePattern: string): string | null {
  const dir = parentDir(targetPath);

  if (!hasGlobChars(specFilePattern)) {
    const specPath = joinPath(dir, specFilePattern);

    return exists(specPath) ? specPath : null;
  }

  const matches = fg.sync(specFilePattern, { cwd: dir, onlyFiles: true, absolute: true });

  return matches.length > 0 ? matches[0] : null;
}
