import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { BatchValidator } from "@/validator/batch-validator.js";
import { CacheManager } from "@/validator/cache-manager.js";
import { PraxisConfig } from "@/core/config.js";

import { createCompilerTmpdir } from "../helpers/compiler-tmpdir.js";
import { createValidatorTmpdir } from "../helpers/validator-tmpdir.js";

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
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_pass",
                  type: "function",
                  function: {
                    name: "validation_pass",
                    arguments: JSON.stringify({ reason: "Fully compliant." }),
                  },
                },
              ],
            },
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
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_fail",
                  type: "function",
                  function: {
                    name: "validation_fail",
                    arguments: JSON.stringify({
                      reason: "Required criteria are not met.",
                      issues: ["Missing required field", "Wrong structure"],
                    }),
                  },
                },
              ],
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

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["roles"],
        files: {
          "roles/SPEC.md": "# Roles Spec\nRequired: name, type",
          "roles/engineer.md": "---\ntype: role\n---\n# Engineer",
        },
        validation: { specFilePattern: "SPEC.md" },
      });

      const batch = new BatchValidator({
        root,
        sources: ["roles"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "SPEC.md",
      });

      const results = await batch.validateAll();

      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("engineer.md");

      cleanup();
    });
  });

  describe("paths frontmatter", () => {
    it("validates files in other directories when spec has paths", async () => {
      useCompliantFixture();

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["specs", "docs"],
        files: {
          "specs/README.md": "---\npaths:\n  - docs/**/*.md\n---\n# Docs Spec\nRequired: title",
          "docs/guide.md": "---\ntitle: Guide\n---\n# Guide",
          "docs/nested/deep.md": "---\ntitle: Deep\n---\n# Deep",
        },
      });

      const batch = new BatchValidator({
        root,
        sources: ["specs", "docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
      });

      const results = await batch.validateAll();
      const filenames = results.map((r) => r.filename).sort();

      expect(filenames).toEqual(["deep.md", "guide.md"]);

      cleanup();
    });

    it("excludes spec files and templates from paths results", async () => {
      useCompliantFixture();

      const { root, abs, cleanup } = createValidatorTmpdir({
        sources: ["specs", "docs"],
        files: {
          "specs/README.md": "---\npaths:\n  - docs/**/*.md\n---\n# Spec",
          "docs/good.md": "# Good doc",
          "docs/_template.md": "# Template",
        },
      });

      const batch = new BatchValidator({
        root,
        sources: ["specs", "docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
      });

      const results = await batch.validateAll();
      const filenames = results.map((r) => r.filename);
      const paths = results.map((r) => r.path);

      expect(filenames).toEqual(["good.md"]);
      expect(paths).toEqual([abs("docs/good.md")]);

      cleanup();
    });

    it("preserves same-directory behavior when no paths frontmatter", async () => {
      useCompliantFixture();

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["roles"],
        files: {
          "roles/README.md": "# Roles Spec\nNo paths frontmatter",
          "roles/engineer.md": "# Engineer",
        },
      });

      const batch = new BatchValidator({
        root,
        sources: ["roles"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
      });

      const results = await batch.validateAll();

      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("engineer.md");

      cleanup();
    });
  });

  describe("ignore does not affect spec discovery", () => {
    it("discovers specs inside ignored directories", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          // Spec lives in an ignored directory
          "docs/smes/events.sme.md":
            '---\npaths:\n  - "docs/content/*.md"\n---\n# Spec\nAll docs need a title.',
          // Target lives outside the ignored directory
          "docs/content/article.md": "# Article",
        },
      });

      useCompliantFixture();

      const batch = new BatchValidator({
        root,
        sources: ["docs"],
        ignore: ["docs/smes/**"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      const results = await batch.validateAll();

      // The spec was discovered despite being in an ignored directory
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("article.md");

      cleanup();
    });

    it("still excludes ignored files from being validated as documents", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/smes/events.sme.md": '---\npaths:\n  - "docs/content/*.md"\n---\n# Spec',
          "docs/content/article.md": "# Article",
          "docs/smes/other.md": "# This is in the ignored dir — should not be validated",
        },
      });

      useCompliantFixture();

      const batch = new BatchValidator({
        root,
        sources: ["docs"],
        ignore: ["docs/smes/**"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      const results = await batch.validateAll();

      // only article.md validated; other.md in ignored dir is excluded from paths expansion
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("article.md");

      cleanup();
    });
  });

  describe("ignore patterns", () => {
    it("excludes files matching ignore from document count", () => {
      const { root, abs, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/roles.praxis.md": "# Spec\nAll docs need a title.",
          "docs/counted.md": "# Counted",
          "docs/generated/output.md": "# Generated — should be ignored",
        },
      });

      const batch = new BatchValidator({
        root,
        sources: ["docs"],
        ignore: ["docs/generated/**"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.praxis.md",
      });

      // countAllSourceDocuments is private; trigger it via summary() after validateAll
      // The total count should exclude the ignored file
      const count = batch["countAllSourceDocuments"]();
      expect(count).toBe(1); // only counted.md; generated/output.md is ignored

      cleanup();
      void abs; // suppress unused warning
    });

    it("excludes ignored directories from spec discovery", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/valid/roles.praxis.md": "# Spec\nAll docs need a title.",
          "docs/valid/counted.md": "# Counted",
          "docs/ignored/spec.praxis.md": "# Ignored spec — should not discover",
          "docs/ignored/doc.md": "# Ignored doc",
        },
      });

      useCompliantFixture();

      const batch = new BatchValidator({
        root,
        sources: ["docs"],
        ignore: ["docs/ignored/**"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.praxis.md",
      });

      const results = await batch.validateAll();

      // Only counted.md in docs/valid/ should be validated; nothing from docs/ignored/
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("counted.md");

      cleanup();
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
