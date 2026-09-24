import type { AgentMetadata, CompilerPlugin } from "@/types.js";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import writeProfileOutputsService from "@/services/write-profile-outputs-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** An empty project to write into. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["src"], files: {} });

  cleanups.push(cleanup);

  return root;
}

/** A plugin that records what it was handed instead of writing. */
function spyPlugin(calls: { profile: string; alias: string }[]): CompilerPlugin {
  return {
    name: "spy",
    compile(profile, _metadata, alias) {
      calls.push({ profile, alias });
    },
  };
}

/** Expert metadata carrying eval targeting. */
function metadata(overrides: Partial<AgentMetadata> = {}): AgentMetadata {
  return {
    name: "scooper",
    description: "A steward.",
    type: "scooper",
    validates: ["src/services/*.ts"],
    excludes: [],
    ...overrides,
  };
}

describe("writeProfileOutputsService", () => {
  it("writes the pure profile where the config says", () => {
    const root = project();
    const cfg = testConfig(root, { agentProfilesOutputDir: "./agent-profiles" });

    writeProfileOutputsService(cfg, {
      profile: "# Expert\n",
      metadata: null,
      alias: "Scooper",
      plugins: [],
    });

    const written = join(root, "agent-profiles", "scooper.expert.md");

    // The alias names the file, lowercased — one spelling on disk
    // whatever case the expert declared.
    expect(existsSync(written)).toBe(true);
    expect(readFileSync(written, "utf8")).toBe("# Expert\n");
  });

  it("carries eval targeting into the profile's frontmatter — the profile is a spec", () => {
    const root = project();
    const cfg = testConfig(root, { agentProfilesOutputDir: "./agent-profiles" });

    writeProfileOutputsService(cfg, {
      profile: "# Expert\n",
      metadata: metadata(),
      alias: "scooper",
      plugins: [],
    });

    const written = readFileSync(join(root, "agent-profiles", "scooper.expert.md"), "utf8");

    expect(written.startsWith("---\n")).toBe(true);
    expect(written).toContain("paths:");
    expect(written).toContain("src/services/*.ts");
    expect(written).toContain("# Expert");
  });

  it("writes no frontmatter when the expert targets nothing", () => {
    const root = project();
    const cfg = testConfig(root, { agentProfilesOutputDir: "./agent-profiles" });

    writeProfileOutputsService(cfg, {
      profile: "# Expert\n",
      metadata: metadata({ validates: [] }),
      alias: "scooper",
      plugins: [],
    });

    const written = readFileSync(join(root, "agent-profiles", "scooper.expert.md"), "utf8");

    // The other targeting keys are meaningless without `validates:`.
    expect(written).toBe("# Expert\n");
  });

  it("writes no profile at all when no output directory is configured", () => {
    const root = project();
    const cfg = testConfig(root, { agentProfilesOutputDir: false });

    writeProfileOutputsService(cfg, {
      profile: "# Expert\n",
      metadata: null,
      alias: "scooper",
      plugins: [],
    });

    expect(existsSync(join(root, "agent-profiles"))).toBe(false);
  });

  it("still runs every plugin when the pure profile is switched off", () => {
    const root = project();
    const calls: { profile: string; alias: string }[] = [];
    const cfg = testConfig(root, { agentProfilesOutputDir: false });

    writeProfileOutputsService(cfg, {
      profile: "# Expert\n",
      metadata: null,
      alias: "scooper",
      plugins: [spyPlugin(calls)],
    });

    expect(calls).toEqual([{ profile: "# Expert\n", alias: "scooper" }]);
  });

  it("hands the same profile to each enabled plugin, in order", () => {
    const root = project();
    const first: { profile: string; alias: string }[] = [];
    const second: { profile: string; alias: string }[] = [];
    const cfg = testConfig(root, { agentProfilesOutputDir: false });

    writeProfileOutputsService(cfg, {
      profile: "# Expert\n",
      metadata: null,
      alias: "scooper",
      plugins: [spyPlugin(first), spyPlugin(second)],
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});
