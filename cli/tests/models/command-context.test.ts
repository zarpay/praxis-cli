import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CommandContext } from "@/models/command-context.js";
import { Paths } from "@/models/project-paths.js";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A throwaway project root with a .praxis/ marker and a config. */
function makeProject(config: object = {}): string {
  const dir = join(tmpdir(), `praxis-ctx-test-${randomUUID()}`);
  mkdirSync(join(dir, ".praxis"), { recursive: true });
  writeFileSync(join(dir, ".praxis", "config.json"), JSON.stringify(config));
  dirs.push(dir);

  return dir;
}

describe("CommandContext", () => {
  it("is constructible where asking for the root would throw — init needs that", () => {
    const ctx = new CommandContext({ paths: new Paths(join(tmpdir(), "nowhere-at-all")) });

    expect(ctx.logger).toBeDefined();
    expect(ctx.out).toBeDefined();
  });

  it("resolves root from the injected paths", () => {
    const dir = makeProject();
    const ctx = new CommandContext({ paths: new Paths(dir) });

    expect(ctx.root).toBe(dir);
  });

  it("reads config lazily from the project root", () => {
    const dir = makeProject({ expertsDir: "people" });
    const ctx = new CommandContext({ paths: new Paths(dir) });

    expect(ctx.config.expertsDir).toBe(join(dir, "people"));
  });

  it("reads the config file once — later edits are invisible to this context", () => {
    const dir = makeProject({ expertsDir: "people" });
    const ctx = new CommandContext({ paths: new Paths(dir) });
    const first = ctx.config;
    writeFileSync(join(dir, ".praxis", "config.json"), JSON.stringify({ expertsDir: "other" }));

    expect(ctx.config).toBe(first);
  });
});
