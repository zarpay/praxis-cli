import { describe, expect, it } from "vitest";

import { palette, stripAnsi } from "@framework/views/palette.js";
import { pathLabel } from "@framework/views/path-label.js";

describe("pathLabel", () => {
  it("prints the whole path, directory and name together", () => {
    const label = pathLabel({ dir: "src/services/", name: "redeem-coupon.ts" });

    expect(stripAnsi(label)).toBe("src/services/redeem-coupon.ts");
  });

  it("recedes the directory into meta and brings the name forward as structure", () => {
    const label = pathLabel({ dir: "src/", name: "awards.ts" });
    const expected = `${palette.meta("src/")}${palette.structure("awards.ts")}`;

    expect(label).toBe(expected);
  });

  it("leaves a bare filename unprefixed", () => {
    const label = pathLabel({ dir: "", name: "awards.ts" });

    expect(label).toBe(palette.structure("awards.ts"));
  });

  it("names no separator of its own — the caller's dir carries it", () => {
    const windowsLabel = pathLabel({ dir: "src\\services\\", name: "awards.ts" });

    expect(stripAnsi(windowsLabel)).toBe("src\\services\\awards.ts");
  });
});
