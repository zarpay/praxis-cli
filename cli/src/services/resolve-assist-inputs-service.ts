import type { AssistFile, AssistInputs, ResolveAssistInputsInput } from "@/types.js";

import fg from "fast-glob";

import { errors } from "@/helpers/errors-helper.js";
import { readText } from "@/helpers/files-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";
import { SpecFile } from "@/models/spec-file.js";

/**
 * Resolves a spec's `exemplars:` and `context:` globs into file contents.
 *
 * The assist inputs a reviewer sees beyond the target itself (03): exemplars are
 * spec-blessed positives, context is what the standard is about. Both reach the
 * prompt, so both join the content hash — a verdict keyed only on target + spec
 * would survive edits to inputs the reviewer actually saw.
 *
 * Results are sorted, so the hash is stable across machines.
 *
 * @throws PraxisError when the spec declares either key and no project root is
 *   available to resolve the root-relative globs against
 */
export default function resolveAssistInputs({
  specContent,
  specPath,
  root,
}: ResolveAssistInputsInput): AssistInputs {
  const spec = SpecFile.fromContent(specContent, specPath);

  return {
    exemplars: resolveKey(spec, "exemplars", root),
    context: resolveKey(spec, "context", root),
  };
}

/** Resolves one assist key's globs into sorted, labeled file contents. */
function resolveKey(spec: SpecFile, key: "exemplars" | "context", root?: string): AssistFile[] {
  const patterns = spec.assistPatterns(key);

  if (patterns.length === 0) return [];

  if (!root) throw errors.missingProjectRoot(key, spec.path);

  return fg
    .sync(patterns, { cwd: root, onlyFiles: true, absolute: true, dot: true })
    .sort()
    .map((file) => ({ path: relativePath(root, file), content: readText(file) }));
}
