import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn().mockReturnValue({ error: null }),
}));

import { spawnSync } from "node:child_process";

import { editConfig, showConfig } from "@/commands/config.js";

import { createCompilerTmpdir } from "../helpers/compiler-tmpdir.js";

describe("config commands", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let configPath: string;

  beforeAll(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;
    configPath = join(tmpdir, ".praxis", "config.json");
  });

  afterAll(() => cleanup());

  describe("showConfig()", () => {
    it("prints the config as formatted JSON", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      showConfig(configPath);
      const output = spy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain('"sources"');
      spy.mockRestore();
    });

    it("prints the config file path", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      showConfig(configPath);
      const output = spy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain(configPath);
      spy.mockRestore();
    });

    it("throws when the config file does not exist", () => {
      expect(() => showConfig("/nonexistent/.praxis/config.json")).toThrow();
    });
  });

  describe("editConfig()", () => {
    afterEach(() => {
      vi.clearAllMocks();
      delete process.env["VISUAL"];
      delete process.env["EDITOR"];
    });

    it("spawns the VISUAL editor with the config path", () => {
      process.env["VISUAL"] = "code";
      editConfig(configPath);
      expect(spawnSync).toHaveBeenCalledWith("code", [configPath], { stdio: "inherit" });
    });

    it("falls back to EDITOR when VISUAL is unset", () => {
      process.env["EDITOR"] = "nano";
      editConfig(configPath);
      expect(spawnSync).toHaveBeenCalledWith("nano", [configPath], { stdio: "inherit" });
    });

    it("falls back to vi when neither VISUAL nor EDITOR is set", () => {
      editConfig(configPath);
      expect(spawnSync).toHaveBeenCalledWith("vi", [configPath], { stdio: "inherit" });
    });

    it("throws when the editor spawn fails", () => {
      vi.mocked(spawnSync).mockReturnValueOnce({ error: new Error("editor not found") } as ReturnType<typeof spawnSync>);
      expect(() => editConfig(configPath)).toThrow("editor not found");
    });
  });
});
