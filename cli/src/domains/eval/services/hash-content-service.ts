import { createHash } from "node:crypto";

/**
 * Computes a cache-key hash from the full review input.
 *
 * Returns the first 8 characters of the SHA256 hex digest. Every input
 * the reviewer saw participates — target, spec, and the serialized assist
 * inputs (exemplars/context, see review-input.ts) — so editing any of
 * them invalidates the cached verdict. The assist component defaults to
 * empty, leaving plain specs' hashes unchanged.
 */
export default function contentHash(
  targetContent: string,
  specContent: string,
  assistInput = "",
): string {
  return createHash("sha256")
    .update(targetContent + specContent + assistInput)
    .digest("hex")
    .slice(0, 8);
}
