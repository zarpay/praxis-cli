import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PraxisProjectBase } from "@/commands/base.js";
import { PraxisBase } from "@/core/base.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Display } from "@/views/display.js";
import { Logger } from "@/views/logger.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";

/** Minimal subclass exposing the protected plumbing for assertions. */
class Plain extends PraxisBase {
  get plumbing(): { out: Display; logger: Logger } {
    return { out: this.out, logger: this.logger };
  }
}

/** Minimal project-bound subclass exposing root and config. */
class Project extends PraxisProjectBase {
  get projectRoot(): string {
    return this.root;
  }

  get projectConfig(): PraxisConfig {
    return this.config;
  }
}

describe("PraxisBase", () => {
  it("provides a Display and a Logger by default", () => {
    const plumbing = new Plain().plumbing;

    expect(plumbing.out).toBeInstanceOf(Display);
    expect(plumbing.logger).toBeInstanceOf(Logger);
  });

  it("uses an injected logger", () => {
    const { logger, output } = createCaptureLogger();

    new Plain({ logger }).plumbing.logger.info("captured");

    expect(output()).toContain("captured");
  });
});

describe("PraxisProjectBase", () => {
  const dirs: string[] = [];

  function makeProjectDir(): string {
    const dir = join(tmpdir(), `praxis-base-test-${randomUUID()}`);
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("binds the project root", () => {
    const dir = makeProjectDir();

    expect(new Project({ root: dir }).projectRoot).toBe(dir);
  });

  it("resolves config lazily from the root", () => {
    const dir = makeProjectDir();
    writeFileSync(join(dir, ".praxis", "config.json"), JSON.stringify({ sources: ["knowledge"] }));

    // Construction must not read the filesystem; the first config access does.
    const project = new Project({ root: dir });

    expect(project.projectConfig.sources).toEqual(["knowledge"]);
  });

  it("prefers an injected config over resolving one", () => {
    const dir = makeProjectDir();
    const injected = new PraxisConfig(dir);

    expect(new Project({ root: dir, config: injected }).projectConfig).toBe(injected);
  });

  it("does not touch the config file at construction time", () => {
    const dir = makeProjectDir();
    writeFileSync(join(dir, ".praxis", "config.json"), "not json{{{");

    // Invalid JSON only throws when config is first accessed.
    const project = new Project({ root: dir });

    expect(() => project.projectConfig).toThrow(/Invalid JSON/);
  });
});
