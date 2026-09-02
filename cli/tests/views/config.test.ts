import { describe, expect, it } from "vitest";

import { configEntries } from "@/views/config.js";

describe("configEntries", () => {
  const entries = configEntries("/p/.praxis/config.json", { sources: ["docs"] });
  const text = entries
    .map((entry) => {
      if (typeof entry === "string") return entry;

      return entry && "text" in entry ? entry.text : "";
    })
    .join("\n");

  it("shows where the configuration lives", () => {
    expect(text).toContain("/p/.praxis/config.json");
  });

  it("shows the configuration as formatted JSON, as written", () => {
    expect(text).toContain('"sources"');
    expect(text).toContain('"docs"');
  });
});
