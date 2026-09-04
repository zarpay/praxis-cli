import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for renaming one parlor. */
export interface RenameParlorInput {
  parlorId: string;
  name: string;
}

/**
 * Renames a parlor everywhere it is listed.
 *
 * Failure modes: unknown parlor id; empty or whitespace-only name.
 */
export function run(store: Store, input: RenameParlorInput): Result<void> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    return { ok: false, error: `no parlor with id "${input.parlorId}" — list parlors for valid ids` };
  }

  if (input.name.trim() === "") {
    return { ok: false, error: "name must be a non-empty string" };
  }

  store.renameParlor(input.parlorId, input.name.trim());

  return { ok: true, value: undefined };
}
