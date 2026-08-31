import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    expect(config.sources).toEqual([
      "experts",
      "practices",
      "roles",
      "responsibilities",
      "reference",
      "context",
    ]);
    expect(config.expertsDir).toBe(join(dir, "experts"));
    expect(config.practicesDir).toBe(join(dir, "practices"));
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
    expect(config.sources).toEqual([
      "experts",
      "practices",
      "roles",
      "responsibilities",
      "reference",
      "context",
    ]);
    expect(config.expertsDir).toBe(join(dir, "experts"));
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

  it("accepts deprecated v1 keys rolesDir and responsibilitiesDir", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { rolesDir: "content/roles", responsibilitiesDir: "content/resps" });

    const config = new PraxisConfig(dir);

    expect(config.expertsDir).toBe(join(dir, "content", "roles"));
    expect(config.practicesDir).toBe(join(dir, "content", "resps"));
  });

  it("prefers v2 keys over deprecated v1 keys when both are present", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { expertsDir: "experts", rolesDir: "roles" });

    const config = new PraxisConfig(dir);

    expect(config.expertsDir).toBe(join(dir, "experts"));
  });

  it("loads custom expertsDir from config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { expertsDir: "knowledge/agents" });

    const config = new PraxisConfig(dir);

    expect(config.expertsDir).toBe(join(dir, "knowledge", "agents"));
  });

  it("loads custom practicesDir from config", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { practicesDir: "knowledge/responsibilities" });

    const config = new PraxisConfig(dir);

    expect(config.practicesDir).toBe(join(dir, "knowledge", "responsibilities"));
  });

  it("throws a descriptive error for invalid JSON", () => {
    const dir = makeTmpdir();
    writeFileSync(join(dir, ".praxis", "config.json"), "not json{{{");

    expect(() => new PraxisConfig(dir)).toThrow(/Invalid JSON in .*config\.json/);
  });

  describe("judges", () => {
    it("loads the judges array with per-judge settings", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        judges: [
          { name: "flash", model: "deepseek/deepseek-v4-flash-0731", apiKeyEnvVar: "OR_KEY" },
          {
            name: "local",
            model: "org-model",
            apiKeyEnvVar: "INTERNAL_KEY",
            baseUrl: "https://inference.internal/v1",
            temperature: 0,
          },
        ],
      });

      const config = new PraxisConfig(dir);

      expect(config.judges).toEqual([
        { name: "flash", model: "deepseek/deepseek-v4-flash-0731", apiKeyEnvVar: "OR_KEY" },
        {
          name: "local",
          model: "org-model",
          apiKeyEnvVar: "INTERNAL_KEY",
          baseUrl: "https://inference.internal/v1",
          temperature: 0,
        },
      ]);
    });

    it("ignores the removed v1 validation section — v2 is a breaking release", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        validation: { apiKeyEnvVar: "OPENROUTER_API_KEY", model: "x-ai/grok-4.1-fast" },
      });

      const config = new PraxisConfig(dir);

      expect(config.judges).toEqual([]);
    });

    it("returns an empty judges array when nothing is configured", () => {
      const dir = makeTmpdir();
      const config = new PraxisConfig(dir);

      expect(config.judges).toEqual([]);
    });

    it("passes provider and options through to the judge config", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        judges: [
          {
            name: "local",
            model: "echo-model",
            apiKeyEnvVar: "OR_KEY",
            provider: "./praxis-providers/echo.js",
            options: { region: "us-east-1" },
          },
        ],
      });

      const config = new PraxisConfig(dir);

      expect(config.judges[0].provider).toBe("./praxis-providers/echo.js");
      expect(config.judges[0].options).toEqual({ region: "us-east-1" });
    });

    it("leaves provider and options absent when unconfigured", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        judges: [{ name: "flash", model: "model-a", apiKeyEnvVar: "OR_KEY" }],
      });

      const config = new PraxisConfig(dir);

      expect(config.judges[0].provider).toBeUndefined();
      expect(config.judges[0].options).toBeUndefined();
    });

    it("rejects duplicate judge names", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        judges: [
          { name: "flash", model: "model-a", apiKeyEnvVar: "OR_KEY" },
          { name: "flash", model: "model-b", apiKeyEnvVar: "OR_KEY" },
        ],
      });

      expect(() => new PraxisConfig(dir)).toThrow('Duplicate judge name "flash"');
    });

    it("rejects a judge missing a required field", () => {
      const dir = makeTmpdir();
      writeConfig(dir, { judges: [{ name: "flash", model: "model-a" }] });

      expect(() => new PraxisConfig(dir)).toThrow('Judge "flash" is missing "apiKeyEnvVar"');
    });
  });

  describe("specFilePattern", () => {
    it("loads a top-level specFilePattern", () => {
      const dir = makeTmpdir();
      writeConfig(dir, { specFilePattern: "*.sme.md" });

      const config = new PraxisConfig(dir);

      expect(config.specFilePattern).toBe("*.sme.md");
    });

    it("defaults to README.md when unconfigured", () => {
      const dir = makeTmpdir();
      const config = new PraxisConfig(dir);

      expect(config.specFilePattern).toBe("README.md");
    });
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
});
