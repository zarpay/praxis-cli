import { describe, expect, it } from "vitest";

import { duration } from "@framework/views/duration.js";

describe("duration", () => {
  it("reads in seconds under a minute", () => {
    expect(duration(8_400)).toBe("8s");
  });

  it("reads in minutes and seconds beyond one", () => {
    expect(duration(80_000)).toBe("1m 20s");
  });

  it("keeps a whole minute whole", () => {
    expect(duration(60_000)).toBe("1m 0s");
  });

  it("floors a negative span at zero rather than rendering nonsense", () => {
    expect(duration(-5)).toBe("0s");
  });
});
