import type { CommandContext } from "@/domains/workspace/models/command-context.js";

import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn().mockReturnValue({ error: null }),
}));

import { spawnSync } from "node:child_process";

import { readJson } from "@/core/files.js";
import editConfig from "@/domains/workspace/orchestrators/edit-config.js";
import { configEntries } from "@/domains/workspace/views/config.js";
import { Display } from "@/views/display.js";
import { testContext } from "@tests/helpers/command-context.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

describe("the config command's parts", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let configPath: string;
  let ctx: CommandContext;

  beforeAll(() => {
    const dir = createCompilerTmpdir();
    tmpdir = dir.tmpdir;
    cleanup = dir.cleanup;
    configPath = join(tmpdir, ".praxis", "config.json");
    ctx = testContext(tmpdir);
  });

  afterAll(() => cleanup());

  describe("show()", () => {
    it("prints the config as formatted JSON", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      new Display().print(configEntries(configPath, readJson(configPath)));
      const output = spy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain('"sources"');
      spy.mockRestore();
    });

    it("prints the config file path", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      new Display().print(configEntries(configPath, readJson(configPath)));
      const output = spy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain(configPath);
      spy.mockRestore();
    });

    it("throws when the config file does not exist", () => {
      expect(() =>
        new Display().print(
          configEntries(
            "/nonexistent/.praxis/config.json",
            readJson("/nonexistent/.praxis/config.json"),
          ),
        ),
      ).toThrow();
    });
  });

  describe("edit()", () => {
    afterEach(() => {
      vi.clearAllMocks();
      delete process.env["VISUAL"];
      delete process.env["EDITOR"];
    });

    it("spawns the VISUAL editor with the config path", async () => {
      process.env["VISUAL"] = "code";
      await editConfig(ctx, {});
      expect(spawnSync).toHaveBeenCalledWith("code", [configPath], { stdio: "inherit" });
    });

    it("falls back to EDITOR when VISUAL is unset", async () => {
      process.env["EDITOR"] = "nano";
      await editConfig(ctx, {});
      expect(spawnSync).toHaveBeenCalledWith("nano", [configPath], { stdio: "inherit" });
    });

    it("falls back to vi when neither VISUAL nor EDITOR is set", async () => {
      await editConfig(ctx, {});
      expect(spawnSync).toHaveBeenCalledWith("vi", [configPath], { stdio: "inherit" });
    });

    it("throws when the editor spawn fails", async () => {
      vi.mocked(spawnSync).mockReturnValueOnce({
        error: new Error("editor not found"),
      } as ReturnType<typeof spawnSync>);
      await expect(editConfig(ctx, {})).rejects.toThrow("editor not found");
    });
  });
});
