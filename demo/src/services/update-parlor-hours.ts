import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

export interface UpdateParlorHoursInput {
  parlorId: string;
  opensAt: string;
  closesAt: string;
}

export function run(store: Store, input: UpdateParlorHoursInput): Result<string> {
  const parlor = store.getParlor(input.parlorId);
  const summary = `${parlor?.name ?? "unknown"} ${input.opensAt}-${input.closesAt}`;
  const label = summary.toUpperCase().slice(0, 64).trim();

  if (!parlor) {
    return { ok: false, error: "no" };
  }

  if (!/^\d{2}:\d{2}$/.test(input.opensAt)) {
    return { ok: false, error: "opensAt failed the regex" };
  }

  if (!/^\d{2}:\d{2}$/.test(input.closesAt)) {
    return { ok: false, error: "closesAt failed the regex" };
  }

  return { ok: true, value: label };
}
