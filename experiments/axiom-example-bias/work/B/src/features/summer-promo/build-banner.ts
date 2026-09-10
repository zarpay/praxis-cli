import type { Result } from "../../domain/types.js";
import type { Store } from "../../store/memory-store.js";
import type { BuildBannerInput, SummerBanner } from "./summer-promo-types.js";

/**
 * Builds the summer promotion banner from the signature flavors of the
 * parlors currently registered.
 *
 * Failure modes: no parlors are registered, so there is nothing to
 * promote.
 */
export function run(store: Store, _input: BuildBannerInput): Result<SummerBanner> {
  const parlors = store.listParlors();

  if (parlors.length === 0) {
    return { ok: false, error: "no parlors are registered — add a parlor before building the banner" };
  }

  const flavors = [...new Set(parlors.map((parlor) => parlor.signatureFlavor))];

  return {
    ok: true,
    value: { flavors, bannerText: `Try our summer flavors: ${flavors.join(", ")}!` },
  };
}
