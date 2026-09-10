import { describe, expect, it } from "vitest";

import pluginManifestTemplate from "@/templates/plugin-manifest-template.js";

describe("pluginManifestTemplate", () => {
  const rendered = pluginManifestTemplate({ name: "my-org" });

  it("fills the configured plugin name", () => {
    expect(JSON.parse(rendered)).toMatchObject({ name: "my-org" });
  });

  it("is valid JSON ending in a newline, matching what writeJson emits", () => {
    expect(rendered.endsWith("}\n")).toBe(true);
    expect(() => JSON.parse(rendered) as unknown).not.toThrow();
  });

  it("carries the starter fields an author edits in place", () => {
    expect(JSON.parse(rendered)).toMatchObject({
      description: "A plugin for integrating assistant profiles with Claude.",
      keywords: ["productivity"],
    });
  });
});
