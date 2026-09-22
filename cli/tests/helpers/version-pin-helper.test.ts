import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PraxisError, USAGE_ERROR_CODES } from "@/helpers/errors-helper.js";
import { enforceVersionPin } from "@/helpers/version-pin-helper.js";
import { CLI_VERSION } from "@/version.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";

/** A throwaway project whose config.json holds exactly these fields. */
function projectWith(config: object | null): string {
  const root = mkdtempSync(join(tmpdir(), "praxis-version-pin-"));

  mkdirSync(join(root, ".praxis"), { recursive: true });

  if (config !== null) {
    writeFileSync(join(root, ".praxis", "config.json"), JSON.stringify(config, null, 2) + "\n");
  }

  return root;
}

/** The project's config file, parsed back. */
function configOf(root: string): Record<string, unknown> {
  const raw = readFileSync(join(root, ".praxis", "config.json"), "utf8");

  return JSON.parse(raw) as Record<string, unknown>;
}

describe("enforceVersionPin", () => {
  it("does nothing outside a praxis project", () => {
    const noProject = mkdtempSync(join(tmpdir(), "praxis-no-project-"));
    const ctx = testContext(noProject);

    expect(() => enforceVersionPin(ctx)).not.toThrow();
  });

  it("does nothing when the project has no config file yet", () => {
    const root = projectWith(null);
    const ctx = testContext(root);

    expect(() => enforceVersionPin(ctx)).not.toThrow();
  });

  it("stays silent when the pin matches this binary", () => {
    const root = projectWith({ version: CLI_VERSION, sources: ["src"] });
    const { logger, output } = createCaptureLogger();
    const ctx = testContext(root, logger);

    enforceVersionPin(ctx);

    expect(output()).toBe("");
    expect(configOf(root)).toEqual({ version: CLI_VERSION, sources: ["src"] });
  });

  it("adopts this binary's version into a config that pins none, and warns", () => {
    const root = projectWith({ sources: ["src"], specFilePattern: "README.md" });
    const { logger, output } = createCaptureLogger();
    const ctx = testContext(root, logger);

    enforceVersionPin(ctx);

    const written = configOf(root);

    expect(written).toEqual({
      version: CLI_VERSION,
      sources: ["src"],
      specFilePattern: "README.md",
    });
    expect(Object.keys(written)[0]).toBe("version");
    expect(output()).toContain(`adopting ${CLI_VERSION}`);
  });

  it("refuses a conflicting pin with both ways out, as a config error", () => {
    const root = projectWith({ version: "0.0.1" });
    const ctx = testContext(root);

    let thrown: unknown;

    try {
      enforceVersionPin(ctx);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PraxisError);

    const error = thrown as PraxisError;

    expect(USAGE_ERROR_CODES.has(error.code)).toBe(true);
    expect(error.message).toContain("npm install -g @zarpay/praxis-cli@0.0.1");
    expect(error.message).toContain(`"version": "${CLI_VERSION}"`);
  });

  it("leaves a conflicting config unmodified", () => {
    const root = projectWith({ version: "0.0.1", sources: ["src"] });
    const ctx = testContext(root);

    expect(() => enforceVersionPin(ctx)).toThrow(PraxisError);
    expect(configOf(root)).toEqual({ version: "0.0.1", sources: ["src"] });
  });
});
