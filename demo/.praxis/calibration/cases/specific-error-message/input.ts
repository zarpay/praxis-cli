import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for archiving one parlor. */
export interface ArchiveParlorInput {
  parlorId: string;
}

/**
 * Archives a parlor so it stops appearing in listings.
 *
 * Failure modes: unknown parlor id; parlor already archived.
 */
export function run(store: Store, input: ArchiveParlorInput): Result<void> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    return { ok: false, error: `no parlor with id "${input.parlorId}" — list parlors for valid ids` };
  }

  if (parlor.archived) {
    return { ok: false, error: `parlor "${input.parlorId}" is already archived — nothing to do` };
  }

  store.archiveParlor(input.parlorId);

  return { ok: true, value: undefined };
}
