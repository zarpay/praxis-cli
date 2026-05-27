import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir as osTmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { BatchValidator } from "@/validator/batch-validator.js";
import { CacheManager } from "@/validator/cache-manager.js";
import { PraxisConfig } from "@/core/config.js";

import { createCompilerTmpdir } from "../helpers/compiler-tmpdir.js";

/** MSW server for intercepting OpenRouter API calls. */
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Configures MSW to return a compliant response for all validation requests. */
function useCompliantFixture(): void {
  server.use(
    http.post("https://openrouter.ai/api/v1/chat/completions", () => {
      return HttpResponse.json({
        choices: [
          {
            message: { content: "Yes — fully compliant." },
          },
        ],
      });
    }),
  );
}

/** Configures MSW to return an error response for all validation requests. */
function useErrorFixture(): void {
  server.use(
    http.post("https://openrouter.ai/api/v1/chat/completions", () => {
      return HttpResponse.json({
        choices: [
          {
            message: {
              content: "No — major issues:\n- Missing required field\n- Wrong structure",
            },
          },
        ],
      });
    }),
  );
}

describe("BatchValidator", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let config: PraxisConfig;

  beforeAll(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;
    config = new PraxisConfig(tmpdir);
    process.env["OPENROUTER_API_KEY"] = "test-key";
  });

  afterAll(() => {
    cleanup();
    delete process.env["OPENROUTER_API_KEY"];
  });

  describe("validateAll()", () => {
    it("validates documents across all types", async () => {
      useCompliantFixture();
      const cacheManager = new CacheManager(join(tmpdir, ".praxis", "cache", "validation"));

      const batch = new BatchValidator({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        cacheManager,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      const results = await batch.validateAll();

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.compliant)).toBe(true);
    });
  });

  describe("validateType()", () => {
    it("validates only documents of the specified type", async () => {
      useCompliantFixture();

      const batch = new BatchValidator({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      const results = await batch.validateType("roles");

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.type.includes("roles"))).toBe(true);
    });

    it("throws for unknown document type", async () => {
      const batch = new BatchValidator({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      await expect(batch.validateType("bogus")).rejects.toThrow("Unknown document type: bogus");
    });
  });

  describe("fail-fast", () => {
    it("stops on first error when fail-fast is enabled", async () => {
      useErrorFixture();

      const batch = new BatchValidator({
        root: tmpdir,
        sources: config.sources,
        failFast: true,
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      await batch.validateAll();

      expect(batch.stopped).toBe(true);
    });
  });

  describe("specFilePattern", () => {
    it("discovers spec files with custom pattern and excludes them from validation", async () => {
      useCompliantFixture();

      const dir = join(osTmpdir(), `praxis-batch-spec-${randomUUID()}`);
      const rolesDir = join(dir, "roles");
      mkdirSync(rolesDir, { recursive: true });
      mkdirSync(join(dir, ".praxis"), { recursive: true });

      writeFileSync(join(rolesDir, "SPEC.md"), "# Roles Spec\nRequired: name, type");
      writeFileSync(join(rolesDir, "engineer.md"), "---\ntype: role\n---\n# Engineer");
      writeFileSync(
        join(dir, ".praxis", "config.json"),
        JSON.stringify({
          sources: ["roles"],
          validation: { apiKeyEnvVar: "OPENROUTER_API_KEY", model: "test", specFilePattern: "SPEC.md" },
        }),
      );

      const batch = new BatchValidator({
        root: dir,
        sources: ["roles"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "SPEC.md",
      });

      const results = await batch.validateAll();

      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("engineer.md");

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("summary()", () => {
    it("aggregates results correctly", async () => {
      useCompliantFixture();

      const batch = new BatchValidator({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      await batch.validateAll();
      const summary = batch.summary();

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.compliant).toBe(summary.total);
      expect(summary.errors).toBe(0);
      expect(summary.warnings).toBe(0);
    });
  });
});
