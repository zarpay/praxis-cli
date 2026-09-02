import type { CommandContext } from "@/models/command-context.js";

import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn().mockReturnValue({ error: null }),
}));

import { spawnSync } from "node:child_process";

import { editConfigOrchestrator } from "@/orchestrators/edit-config-orchestrator.js";
import { testContext } from "@tests/helpers/command-context.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

describe("editConfigOrchestrator", () => {
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

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env["VISUAL"];
    delete process.env["EDITOR"];
  });

  it("spawns the VISUAL editor with the config path", async () => {
    process.env["VISUAL"] = "code";
    await editConfigOrchestrator(ctx, {});
    expect(spawnSync).toHaveBeenCalledWith("code", [configPath], { stdio: "inherit" });
  });

  it("falls back to EDITOR when VISUAL is unset", async () => {
    process.env["EDITOR"] = "nano";
    await editConfigOrchestrator(ctx, {});
    expect(spawnSync).toHaveBeenCalledWith("nano", [configPath], { stdio: "inherit" });
  });

  it("falls back to vi when neither VISUAL nor EDITOR is set", async () => {
    await editConfigOrchestrator(ctx, {});
    expect(spawnSync).toHaveBeenCalledWith("vi", [configPath], { stdio: "inherit" });
  });

  it("splits an editor value that carries arguments, keeping the file last", async () => {
    process.env["VISUAL"] = "omarchy-launch-editor --inline";
    await editConfigOrchestrator(ctx, {});
    expect(spawnSync).toHaveBeenCalledWith("omarchy-launch-editor", ["--inline", configPath], {
      stdio: "inherit",
    });
  });

  it("throws when the editor spawn fails", async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: new Error("editor not found"),
    } as ReturnType<typeof spawnSync>);
    await expect(editConfigOrchestrator(ctx, {})).rejects.toThrow("editor not found");
  });
});
