import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/core/config.js";

describe("PraxisConfig", () => {
  const dirs: string[] = [];

  function makeTmpdir(): string {
    const dir = join(tmpdir(), `praxis-config-test-${randomUUID()}`);
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    dirs.push(dir);
    return dir;
  }

  function writeConfig(dir: string, config: Record<string, unknown>): void {
    writeFileSync(join(dir, ".praxis", "config.json"), JSON.stringify(config));
  }

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("uses defaults when no config file exists", () => {
    const dir = makeTmpdir();
    const config = new PraxisConfig(dir);

    expect(config.agentProfilesOutputDir).toBe(join(dir, "agent-profiles"));
    expect(config.plugins).toEqual([]);
    expect(config.sources).toEqual(["roles", "responsibilities", "reference", "context"]);
    expect(config.rolesDir).toBe(join(dir, "roles"));
    expect(config.responsibilitiesDir).toBe(join(dir, "responsibilities"));
  });

  it("loads agentProfilesOutputDir from config file", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { agentProfilesOutputDir: "./custom-profiles" });

    const config = new PraxisConfig(dir);

    expect(config.agentProfilesOutputDir).toBe(join(dir, "custom-profiles"));
  });

  it("returns null when agentProfilesOutputDir is false", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { agentProfilesOutputDir: false });

    const config = new PraxisConfig(dir);

    expect(config.agentProfilesOutputDir).toBeNull();
  });

  it("normalizes string plugins to PluginConfigEntry objects", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: ["claude-code"] });

    const config = new PraxisConfig(dir);

    expect(config.plugins).toEqual([{ name: "claude-code" }]);
  });

  it("passes through object-form plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      plugins: [{ name: "claude-code", outputDir: "./custom", claudeCodePluginName: "my-agents" }],
    });

    const config = new PraxisConfig(dir);

    expect(config.plugins).toEqual([
      { name: "claude-code", outputDir: "./custom", claudeCodePluginName: "my-agents" },
    ]);
  });

  it("handles mixed string and object plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      plugins: ["claude-code", { name: "claude-code", claudeCodePluginName: "alt" }],
    });

    const config = new PraxisConfig(dir);

    expect(config.plugins).toHaveLength(2);
    expect(config.plugins[0]).toEqual({ name: "claude-code" });
    expect(config.plugins[1]).toEqual({ name: "claude-code", claudeCodePluginName: "alt" });
  });

  it("pluginNames returns array of name strings", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: [{ name: "claude-code" }] });

    const config = new PraxisConfig(dir);

    expect(config.pluginNames).toEqual(["claude-code"]);
  });

  it("defaults missing keys when config file is partial", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: ["claude-code"] });

    const config = new PraxisConfig(dir);

    // agentProfilesOutputDir should use default
    expect(config.agentProfilesOutputDir).toBe(join(dir, "agent-profiles"));
    expect(config.plugins).toEqual([{ name: "claude-code" }]);
    expect(config.sources).toEqual(["roles", "responsibilities", "reference", "context"]);
    expect(config.rolesDir).toBe(join(dir, "roles"));
  });

  it("pluginEnabled returns true for string-form plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: ["claude-code"] });

    const config = new PraxisConfig(dir);

    expect(config.pluginEnabled("claude-code")).toBe(true);
    expect(config.pluginEnabled("unknown")).toBe(false);
  });

  it("pluginEnabled returns true for object-form plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: [{ name: "claude-code", claudeCodePluginName: "my-org" }] });

    const config = new PraxisConfig(dir);

    expect(config.pluginEnabled("claude-code")).toBe(true);
    expect(config.pluginEnabled("unknown")).toBe(false);
  });

  it("pluginEnabled returns false when plugins array is empty", () => {
    const dir = makeTmpdir();
    const config = new PraxisConfig(dir);

    expect(config.pluginEnabled("claude-code")).toBe(false);
  });

  it("loads custom sources from config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { sources: ["knowledge", "docs"] });

    const config = new PraxisConfig(dir);

    expect(config.sources).toEqual(["knowledge", "docs"]);
  });

  it("loads custom rolesDir from config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { rolesDir: "knowledge/agents" });

    const config = new PraxisConfig(dir);

    expect(config.rolesDir).toBe(join(dir, "knowledge", "agents"));
  });

  it("loads custom responsibilitiesDir from config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { responsibilitiesDir: "knowledge/responsibilities" });

    const config = new PraxisConfig(dir);

    expect(config.responsibilitiesDir).toBe(join(dir, "knowledge", "responsibilities"));
  });

  it("loads validation config from config file", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      validation: { apiKeyEnvVar: "MY_KEY", model: "some-model" },
    });

    const config = new PraxisConfig(dir);

    expect(config.validation).toEqual({ apiKeyEnvVar: "MY_KEY", model: "some-model" });
  });

  it("returns undefined validation when not in config", () => {
    const dir = makeTmpdir();
    const config = new PraxisConfig(dir);

    expect(config.validation).toBeUndefined();
  });

  it("loads specFilePattern from validation config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      validation: { apiKeyEnvVar: "MY_KEY", model: "some-model", specFilePattern: "*.validate.md" },
    });

    const config = new PraxisConfig(dir);

    expect(config.validation?.specFilePattern).toBe("*.validate.md");
  });

  it("loads ignore patterns from config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { ignore: ["docs/generated/**", "**/.*.md"] });

    const config = new PraxisConfig(dir);

    expect(config.ignore).toEqual(["docs/generated/**", "**/.*.md"]);
  });

  it("defaults ignore to empty array when not in config", () => {
    const dir = makeTmpdir();
    const config = new PraxisConfig(dir);

    expect(config.ignore).toEqual([]);
  });

  it("returns undefined specFilePattern when not specified", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      validation: { apiKeyEnvVar: "MY_KEY", model: "some-model" },
    });

    const config = new PraxisConfig(dir);

    expect(config.validation?.specFilePattern).toBeUndefined();
  });
});
