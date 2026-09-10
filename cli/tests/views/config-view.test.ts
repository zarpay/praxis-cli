import { describe, expect, it } from "vitest";

import configView from "@/views/config-view.js";
import { reportText } from "@tests/helpers/report-text.js";

describe("configView", () => {
  const text = reportText(
    configView({ configPath: "/p/.praxis/config.json", config: { sources: ["docs"] } }),
  );

  it("shows where the configuration lives", () => {
    expect(text).toContain("/p/.praxis/config.json");
  });

  it("shows the configuration as formatted JSON, as written", () => {
    expect(text).toContain('"sources"');
    expect(text).toContain('"docs"');
  });
});
