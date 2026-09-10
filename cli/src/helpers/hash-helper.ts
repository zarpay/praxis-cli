import { createHash } from "node:crypto";

/**
 * The codebase's standard content hash: an 8-char sha256 prefix.
 *
 * Every content identity — review inputs, cache keys, calibration case
 * sets — goes through this one function, so "content hash" means the
 * same thing everywhere it appears in the ledger.
 */
export function hash8(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}
