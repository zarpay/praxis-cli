import type { AgentMetadata } from "@/types.js";

import { describe, expect, it } from "vitest";

import evalTargetingTemplate from "@/templates/eval-targeting-template.js";

/** A complete AgentMetadata with only the fields a test cares about set. */
function metadata(fields: Partial<AgentMetadata> = {}): AgentMetadata {
  return {
    name: "guards-expert",
    description: "Reviews guards.",
    type: "guards.expert",
    validates: ["gem/lib/servus/guards/**/*.rb"],
    excludes: [],
    ...fields,
  };
}

describe("evalTargetingTemplate", () => {
  it("compiles the targeting keys through: type, paths, cohort, excludes", () => {
    const lines = evalTargetingTemplate(
      metadata({ cohort: "by_directory", excludes: ["gem/lib/servus/guard.rb"] }),
    );

    expect(lines).toEqual([
      'type: "guards.expert"',
      "paths:",
      '  - "gem/lib/servus/guards/**/*.rb"',
      "cohort: by_directory",
      "excludes:",
      '  - "gem/lib/servus/guard.rb"',
    ]);
  });

  it("carries the alias as the type: label", () => {
    const lines = evalTargetingTemplate(metadata({ type: "docs.expert" }));

    expect(lines).toContain('type: "docs.expert"');
  });

  it("emits nothing without validates: — the other keys are meaningless alone", () => {
    expect(evalTargetingTemplate(metadata({ validates: [] }))).toEqual([]);
  });
});
