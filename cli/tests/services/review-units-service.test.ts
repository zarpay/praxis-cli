import type { GovernedUnit, ReviewedTarget } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import reviewUnitsService from "@/services/review-units-service.js";
import {
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  server.resetHandlers();
  while (cleanups.length) cleanups.pop()?.();
});

/** A project with one governed file, and its resolved units. */
function project(): { root: string; units: GovernedUnit[] } {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": '---\npaths:\n  - "docs/*.md"\n---\n\n# Spec\n',
      "docs/guide.md": "# Guide\n",
    },
    reviewers: [{ name: "one", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
  });
  cleanups.push(cleanup);

  const cfg = config(root);
  const [domain] = discoverDomainsService(cfg, {});
  const units = resolveUnitsService(cfg, { domain: domain }).map((unit) => ({
    unit,
    domain: domain,
  }));

  return { root, units };
}

/** The config for a project, with one keyed reviewer. */
function config(root: string) {
  return testConfig(root, {
    sources: ["docs"],
    reviewers: [{ name: "one", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
  });
}

/** Every run record written under the project. */
function runs(root: string) {
  const dir = join(root, ".praxis", "ledger", "runs");

  if (!existsSync(dir)) return [];

  return readdirSync(dir).map(
    (file) =>
      JSON.parse(readFileSync(join(dir, file), "utf8").split("\n")[0]) as Record<string, unknown>,
  );
}

/** Whether any verdict was cached. */
function cacheWritten(root: string): boolean {
  return existsSync(join(root, ".praxis", "cache", "validation"));
}

describe("reviewUnitsService", () => {
  it("stamps the run record with the scope it was given", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const { root, units } = project();

    await reviewUnitsService(config(root), { units, scope: "advisory" });

    expect(runs(root)[0]?.["scope"]).toBe("advisory");
  });

  it("reads the cache but never writes it when writeCache is off", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const { root, units } = project();

    await reviewUnitsService(config(root), { units, scope: "advisory", writeCache: false });

    // A cache hit writes no critique record, so a cached advisory verdict
    // would suppress the evidence the next measurement run owes.
    expect(cacheWritten(root)).toBe(false);
  });

  it("writes the cache when it is allowed to", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const { root, units } = project();

    await reviewUnitsService(config(root), { units, scope: "files" });

    expect(cacheWritten(root)).toBe(true);
  });

  it("counts an error verdict as an error, and reports it to the caller", async () => {
    useOpenRouterResponse(
      server,
      validationToolCallResponse("validation_fail", { reason: "bad", issues: ["broken"] }),
    );
    const { root, units } = project();

    const result = await reviewUnitsService(config(root), { units, scope: "files" });

    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(0);
  });

  it("counts a warning separately from an error", async () => {
    useOpenRouterResponse(
      server,
      validationToolCallResponse("validation_warn", { reason: "meh", issues: ["thin"] }),
    );
    const { root, units } = project();

    const result = await reviewUnitsService(config(root), { units, scope: "files" });

    expect(result.warnings).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("streams each unit to onUnit, named relative to the root", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const { root, units } = project();
    const seen: ReviewedTarget[] = [];

    await reviewUnitsService(config(root), {
      units,
      scope: "files",
      onUnit: (event) => seen.push(event),
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.path).toBe("docs/guide.md");
  });

  it("totals the run's usage for the caller's spend line", async () => {
    useOpenRouterResponse(
      server,
      validationToolCallResponse(
        "validation_pass",
        { reason: "ok" },
        { prompt_tokens: 100, completion_tokens: 20, cost: 0.002 },
      ),
    );
    const { root, units } = project();

    const result = await reviewUnitsService(config(root), { units, scope: "files" });

    expect(result.usage?.costUsd).toBe(0.002);
  });

  it("writes no run record at all when given no units", async () => {
    const { root } = project();

    const result = await reviewUnitsService(config(root), { units: [], scope: "advisory" });

    expect(runs(root)).toEqual([]);
    expect(result).toMatchObject({ errors: 0, warnings: 0, usage: null });
  });
});
