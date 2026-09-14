import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for notifying a parlor that a new review landed. */
export interface NotifyParlorInput {
  parlorId: string;
  message: string;
}

/**
 * Sends a parlor a notification about a new review.
 *
 * Failure modes: the parlor does not exist.
 */
export async function run(store: Store, input: NotifyParlorInput): Promise<Result<string>> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    return { ok: false, error: "parlor must be an id returned by listParlors" };
  }

  console.log(`notifying ${parlor.name}: ${input.message}`);

  const response = await fetch("https://hooks.scoopsociety.example/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parlorId: parlor.id, message: input.message, retries: 3 }),
    signal: AbortSignal.timeout(5000),
  });

  return { ok: true, value: `${response.status}` };
}
