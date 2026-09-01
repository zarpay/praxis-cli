/**
 * Assist inputs: the spec-declared files that join the judgment input
 * beyond the target itself (03) — `exemplars:` (spec-blessed positives)
 * and `context:` (what the standard is about; never judged).
 *
 * Both kinds reach the judge's prompt, so both join the content hash
 * (05: a verdict keyed only on target + spec would survive edits to
 * inputs the judge actually saw). Resolution and hash serialization
 * live here and nowhere else, so every hash producer — the Judge and
 * the staleness check in VerdictReporter — resolves identically.
 */

import type { AssistFile, AssistFileRecord, AssistInputs } from "@/types.js";

import fg from "fast-glob";
import { createHash } from "node:crypto";

import { errors } from "@/core/errors.js";
import { readText } from "@/core/files.js";
import { relativePath } from "@/core/paths.js";
import { SpecFile } from "@/models/spec-file.js";

/**
 * Resolves a spec's `exemplars:` and `context:` globs into file contents.
 *
 * Globs are project-root-relative; results are sorted for deterministic
 * hashing. Specs declaring neither key resolve to empty lists.
 *
 * @throws PraxisError when the spec declares either key and no project
 *   root is available to resolve the root-relative globs against
 */
export function resolveAssistInputs({
  specContent,
  specPath,
  root,
}: {
  specContent: string;
  /** Used only for the error message when root is missing. */
  specPath: string;
  root?: string;
}): AssistInputs {
  const spec = SpecFile.fromContent(specContent, specPath);

  return {
    exemplars: resolveKey(spec, "exemplars", root),
    context: resolveKey(spec, "context", root),
  };
}

/** Resolves one frontmatter key's globs into sorted, labeled file contents. */
function resolveKey(spec: SpecFile, key: "exemplars" | "context", root?: string): AssistFile[] {
  const patterns = spec.assistPatterns(key);

  if (patterns.length === 0) return [];

  if (!root) throw errors.missingProjectRoot(key, spec.path);

  return fg
    .sync(patterns, { cwd: root, onlyFiles: true, absolute: true, dot: true })
    .sort()
    .map((file) => ({ path: relativePath(root, file), content: readText(file) }));
}

/**
 * Serializes assist inputs into the content hash's third component.
 *
 * Kind and path label each block so distinct assist states can never
 * serialize identically. Returns the empty string when the spec
 * declares no assist inputs, keeping plain specs' hashes unchanged.
 */
export function assistHashInput(assist: AssistInputs): string {
  const blocks = [
    ...assist.exemplars.map((f) => `EXEMPLAR ${f.path}\n${f.content}`),
    ...assist.context.map((f) => `CONTEXT ${f.path}\n${f.content}`),
  ];

  return blocks.join("\n");
}

/**
 * Builds the per-file provenance records a cache entry stores (05: the
 * resolved file list plus each file's content hash).
 */
export function assistFileRecords(files: AssistFile[]): AssistFileRecord[] {
  return files.map((f) => ({
    path: f.path,
    hash: createHash("sha256").update(f.content).digest("hex").slice(0, 8),
  }));
}
