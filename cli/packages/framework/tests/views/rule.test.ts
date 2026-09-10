import { describe, expect, it } from "vitest";

import { rule } from "@framework/views/rule.js";

describe("rule", () => {
  it("draws the default character at the default width", () => {
    expect(rule()).toBe("─".repeat(50));
  });

  it("honors the caller's character and width", () => {
    expect(rule("=", 8)).toBe("========");
  });
});
