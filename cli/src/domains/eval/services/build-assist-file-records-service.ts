import type { AssistFile, AssistFileRecord } from "@/domains/eval/types.js";

import { createHash } from "node:crypto";

/**
 * Builds the per-file provenance records a cache entry stores (05: the
 * resolved file list plus each file's content hash).
 */
export default function assistFileRecords(files: AssistFile[]): AssistFileRecord[] {
  return files.map((f) => ({
    path: f.path,
    hash: createHash("sha256").update(f.content).digest("hex").slice(0, 8),
  }));
}
