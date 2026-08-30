import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/core/config.js";
import { BatchJudge } from "@/eval/batch-judge.js";
import { CacheManager } from "@/eval/cache-manager.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import {
  OPENROUTER_URL,
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Configures MSW to return a compliant response for all validation requests. */
function useCompliantFixture(): void {
  useOpenRouterResponse(
    server,
    validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
  );
}

/** Configures MSW to return a failing response for all validation requests. */
function useErrorFixture(): void {
  useOpenRouterResponse(
    server,
    validationToolCallResponse("validation_fail", {
      reason: "Required criteria are not met.",
      issues: ["Missing required field", "Wrong structure"],
    }),
  );
}

describe("BatchJudge", () => {
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      const results = await batch.validateType("experts");

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.type.includes("experts"))).toBe(true);
    });

    it("throws for unknown document type", async () => {
      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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

      const batch = new BatchJudge({
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
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/roles.praxis.md": "# Spec\nAll docs need a title.",
          "docs/counted.md": "# Counted",
          "docs/generated/output.md": "# Generated — should be ignored",
        },
      });

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        ignore: ["docs/generated/**"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.praxis.md",
      });

      const docs = batch["collectSourceDocuments"]();
      expect(docs.size).toBe(1); // only counted.md; generated/output.md is ignored

      cleanup();
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

      const batch = new BatchJudge({
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

  describe("cohort: by_directory", () => {
    /** A spec grouping first-layer service directories into single units. */
    function cohortProject() {
      return createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/services.sme.md":
            '---\npaths:\n  - "src/services/*"\ncohort: by_directory\n---\n# Service Spec',
          "src/services/alpha/a.ts": "ALPHA_A_CONTENT",
          "src/services/alpha/b.ts": "ALPHA_B_CONTENT",
          "src/services/beta/c.ts": "BETA_C_CONTENT",
        },
        validation: { specFilePattern: "*.sme.md" },
      });
    }

    it("judges each matched directory as one evaluation unit", async () => {
      useCompliantFixture();
      const { root, cleanup } = cohortProject();

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      const results = await batch.validateAll();

      expect(results.map((r) => r.filename).sort()).toEqual(["alpha", "beta"]);

      cleanup();
    });

    it("sends every member file in a single judgment request", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
          );
        }),
      );
      const { root, cleanup } = cohortProject();

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      await batch.validateAll();

      const alphaBody = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(alphaBody).toContain("ALPHA_B_CONTENT");

      cleanup();
    });

    it("labels each member with its project-relative path in the request", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
          );
        }),
      );
      const { root, cleanup } = cohortProject();

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      await batch.validateAll();

      const alphaBody = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(alphaBody).toContain("src/services/alpha/a.ts");

      cleanup();
    });

    it("caches per cohort and invalidates when any member changes", async () => {
      useCompliantFixture();
      const { root, abs, cleanup } = cohortProject();

      function makeBatch() {
        return new BatchJudge({
          root,
          sources: ["docs"],
          apiKeyEnvVar: "OPENROUTER_API_KEY",
          model: "test",
          specFilePattern: "*.sme.md",
        });
      }

      const first = makeBatch();
      await first.validateAll();
      expect(first.cacheStats).toEqual({ hits: 0, misses: 2 });

      const second = makeBatch();
      await second.validateAll();
      expect(second.cacheStats).toEqual({ hits: 2, misses: 0 });

      writeFileSync(abs("src/services/alpha/a.ts"), "ALPHA_A_EDITED");

      const third = makeBatch();
      await third.validateAll();
      expect(third.cacheStats).toEqual({ hits: 1, misses: 1 });

      cleanup();
    });

    it("treats cohort: by_file as the ordinary per-file behavior", async () => {
      useCompliantFixture();
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/services.sme.md":
            '---\npaths:\n  - "src/services/**/*.ts"\ncohort: by_file\n---\n# Spec',
          "src/services/alpha/a.ts": "A",
          "src/services/beta/c.ts": "C",
        },
        validation: { specFilePattern: "*.sme.md" },
      });

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      const results = await batch.validateAll();

      expect(results.map((r) => r.filename).sort()).toEqual(["a.ts", "c.ts"]);

      cleanup();
    });

    it("rejects an unknown cohort value with the accepted options", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/services.sme.md": '---\npaths:\n  - "src/*"\ncohort: by_magic\n---\n# Spec',
          "src/a.ts": "A",
        },
        validation: { specFilePattern: "*.sme.md" },
      });

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      await expect(batch.validateAll()).rejects.toThrow('Invalid cohort value "by_magic"');

      cleanup();
    });
  });

  describe("summary()", () => {
    it("counts non-.md targets without going negative", async () => {
      useCompliantFixture();

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          // One spec targeting three .rb files; no other .md source docs.
          "docs/events.sme.md": '---\npaths:\n  - "src/**/*.rb"\n---\n# Spec',
          "src/a.rb": "# A",
          "src/b.rb": "# B",
          "src/c.rb": "# C",
        },
        validation: { specFilePattern: "*.sme.md" },
      });

      const batch = new BatchJudge({
        root,
        sources: ["docs"],
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "test",
        specFilePattern: "*.sme.md",
      });

      await batch.validateAll();
      const summary = batch.summary();

      // Three validated targets outnumber the zero .md source docs;
      // the totals must reflect the targets, never a negative remainder.
      expect(summary.total).toBe(3);
      expect(summary.compliant).toBe(3);
      expect(summary.notValidated).toBe(0);

      cleanup();
    });

    it("aggregates results correctly", async () => {
      useCompliantFixture();

      const batch = new BatchJudge({
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
