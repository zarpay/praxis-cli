import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";

describe("PraxisConfig", () => {
  const dirs: string[] = [];

  function makeTmpdir(): string {
    const dir = join(tmpdir(), `praxis-config-test-${randomUUID()}`);
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    dirs.push(dir);
    return dir;
  }

  function writeConfig(dir: string, cfg: Record<string, unknown>): void {
    writeFileSync(join(dir, ".praxis", "config.json"), JSON.stringify(cfg));
  }

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("uses defaults when no config file exists", () => {
    const dir = makeTmpdir();
    const cfg = new PraxisConfig(dir);

    expect(cfg.agentProfilesOutputDir).toBe(join(dir, "agent-profiles"));
    expect(cfg.plugins).toEqual([]);
    expect(cfg.sources).toEqual(["experts", "practices", "reference", "context"]);
    expect(cfg.expertsDir).toBe(join(dir, "experts"));
    expect(cfg.practicesDir).toBe(join(dir, "practices"));
  });

  it("loads agentProfilesOutputDir from config file", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { agentProfilesOutputDir: "./custom-profiles" });

    const cfg = new PraxisConfig(dir);

    expect(cfg.agentProfilesOutputDir).toBe(join(dir, "custom-profiles"));
  });

  it("returns null when agentProfilesOutputDir is false", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { agentProfilesOutputDir: false });

    const cfg = new PraxisConfig(dir);

    expect(cfg.agentProfilesOutputDir).toBeNull();
  });

  it("normalizes string plugins to PluginConfigEntry objects", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: ["claude-code"] });

    const cfg = new PraxisConfig(dir);

    expect(cfg.plugins).toEqual([{ name: "claude-code" }]);
  });

  it("passes through object-form plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      plugins: [{ name: "claude-code", outputDir: "./custom", claudeCodePluginName: "my-agents" }],
    });

    const cfg = new PraxisConfig(dir);

    expect(cfg.plugins).toEqual([
      { name: "claude-code", outputDir: "./custom", claudeCodePluginName: "my-agents" },
    ]);
  });

  it("handles mixed string and object plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, {
      plugins: ["claude-code", { name: "claude-code", claudeCodePluginName: "alt" }],
    });

    const cfg = new PraxisConfig(dir);

    expect(cfg.plugins).toHaveLength(2);
    expect(cfg.plugins[0]).toEqual({ name: "claude-code" });
    expect(cfg.plugins[1]).toEqual({ name: "claude-code", claudeCodePluginName: "alt" });
  });

  it("pluginNames returns array of name strings", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: [{ name: "claude-code" }] });

    const cfg = new PraxisConfig(dir);

    expect(cfg.pluginNames).toEqual(["claude-code"]);
  });

  it("defaults missing keys when cfg file is partial", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: ["claude-code"] });

    const cfg = new PraxisConfig(dir);

    // agentProfilesOutputDir should use default
    expect(cfg.agentProfilesOutputDir).toBe(join(dir, "agent-profiles"));
    expect(cfg.plugins).toEqual([{ name: "claude-code" }]);
    expect(cfg.sources).toEqual(["experts", "practices", "reference", "context"]);
    expect(cfg.expertsDir).toBe(join(dir, "experts"));
  });

  it("pluginEnabled returns true for string-form plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: ["claude-code"] });

    const cfg = new PraxisConfig(dir);

    expect(cfg.pluginEnabled("claude-code")).toBe(true);
    expect(cfg.pluginEnabled("unknown")).toBe(false);
  });

  it("pluginEnabled returns true for object-form plugins", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { plugins: [{ name: "claude-code", claudeCodePluginName: "my-org" }] });

    const cfg = new PraxisConfig(dir);

    expect(cfg.pluginEnabled("claude-code")).toBe(true);
    expect(cfg.pluginEnabled("unknown")).toBe(false);
  });

  it("pluginEnabled returns false when plugins array is empty", () => {
    const dir = makeTmpdir();
    const cfg = new PraxisConfig(dir);

    expect(cfg.pluginEnabled("claude-code")).toBe(false);
  });

  it("loads custom sources from cfg", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { sources: ["knowledge", "docs"] });

    const cfg = new PraxisConfig(dir);

    expect(cfg.sources).toEqual(["knowledge", "docs"]);
  });

  it("loads custom expertsDir from cfg", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { expertsDir: "knowledge/agents" });

    const cfg = new PraxisConfig(dir);

    expect(cfg.expertsDir).toBe(join(dir, "knowledge", "agents"));
  });

  it("loads custom practicesDir from cfg", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { practicesDir: "knowledge/responsibilities" });

    const cfg = new PraxisConfig(dir);

    expect(cfg.practicesDir).toBe(join(dir, "knowledge", "responsibilities"));
  });

  it("throws a descriptive error for invalid JSON", () => {
    const dir = makeTmpdir();
    writeFileSync(join(dir, ".praxis", "config.json"), "not json{{{");

    expect(() => new PraxisConfig(dir)).toThrow(/Invalid JSON in .*config\.json/);
  });

  describe("reviewers", () => {
    it("loads the reviewers array with per-reviewer settings", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        reviewers: [
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

      const cfg = new PraxisConfig(dir);

      expect(cfg.reviewers).toEqual([
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

      const cfg = new PraxisConfig(dir);

      expect(cfg.reviewers).toEqual([]);
    });

    it("returns an empty reviewers array when nothing is configured", () => {
      const dir = makeTmpdir();
      const cfg = new PraxisConfig(dir);

      expect(cfg.reviewers).toEqual([]);
    });

    it("passes provider and options through to the reviewer cfg", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        reviewers: [
          {
            name: "local",
            model: "echo-model",
            apiKeyEnvVar: "OR_KEY",
            provider: "./praxis-providers/echo.js",
            options: { region: "us-east-1" },
          },
        ],
      });

      const cfg = new PraxisConfig(dir);

      expect(cfg.reviewers[0].provider).toBe("./praxis-providers/echo.js");
      expect(cfg.reviewers[0].options).toEqual({ region: "us-east-1" });
    });

    it("leaves provider and options absent when unconfigured", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        reviewers: [{ name: "flash", model: "model-a", apiKeyEnvVar: "OR_KEY" }],
      });

      const cfg = new PraxisConfig(dir);

      expect(cfg.reviewers[0].provider).toBeUndefined();
      expect(cfg.reviewers[0].options).toBeUndefined();
    });

    it("rejects duplicate reviewer names", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {
        reviewers: [
          { name: "flash", model: "model-a", apiKeyEnvVar: "OR_KEY" },
          { name: "flash", model: "model-b", apiKeyEnvVar: "OR_KEY" },
        ],
      });

      expect(() => new PraxisConfig(dir)).toThrow('Duplicate reviewer name "flash"');
    });

    it("rejects a reviewer missing a required field", () => {
      const dir = makeTmpdir();
      writeConfig(dir, { reviewers: [{ name: "flash", model: "model-a" }] });

      expect(() => new PraxisConfig(dir)).toThrow('Reviewer "flash" is missing "apiKeyEnvVar"');
    });
  });

  describe("curator", () => {
    it("is null when the cfg declares none", () => {
      const dir = makeTmpdir();
      writeConfig(dir, {});

      const cfg = new PraxisConfig(dir);

      expect(cfg.curator).toBeNull();
    });

    it("normalizes a declared curator, keeping unset optionals absent", () => {
      const dir = makeTmpdir();
      writeConfig(dir, { curator: { model: "big/model", apiKeyEnvVar: "KEY", temperature: 0.2 } });

      const cfg = new PraxisConfig(dir);

      expect(cfg.curator).toEqual({ model: "big/model", apiKeyEnvVar: "KEY", temperature: 0.2 });
    });

    it("throws when a declared curator omits a required field", () => {
      const dir = makeTmpdir();
      writeConfig(dir, { curator: { apiKeyEnvVar: "KEY" } });

      const readCurator = () => new PraxisConfig(dir).curator;

      expect(readCurator).toThrow(/missing required field "model"/);
    });
  });

  describe("specFilePattern", () => {
    it("loads a top-level specFilePattern", () => {
      const dir = makeTmpdir();
      writeConfig(dir, { specFilePattern: "*.sme.md" });

      const cfg = new PraxisConfig(dir);

      expect(cfg.specFilePattern).toBe("*.sme.md");
    });

    it("defaults to README.md when unconfigured", () => {
      const dir = makeTmpdir();
      const cfg = new PraxisConfig(dir);

      expect(cfg.specFilePattern).toBe("README.md");
    });
  });

  it("loads ignore patterns from cfg", () => {
    const dir = makeTmpdir();
    writeConfig(dir, { ignore: ["docs/generated/**", "**/.*.md"] });

    const cfg = new PraxisConfig(dir);

    expect(cfg.ignore).toEqual(["docs/generated/**", "**/.*.md"]);
  });

  it("defaults ignore to empty array when not in cfg", () => {
    const dir = makeTmpdir();
    const cfg = new PraxisConfig(dir);

    expect(cfg.ignore).toEqual([]);
  });
});
