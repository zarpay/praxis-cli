import { HttpResponse, http } from "msw";
import { writeFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/core/config.js";
import { EvalRun } from "@/eval/eval-run.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import {
  OPENROUTER_URL,
  TEST_JUDGE,
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

describe("EvalRun", () => {
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

  describe("forProject()", () => {
    it("projects sources off the config", () => {
      const run = EvalRun.forProject(tmpdir, config);

      expect(run.sources).toEqual(config.sources);
    });

    it("defaults to no fail-fast when no override is given", () => {
      const run = EvalRun.forProject(tmpdir, config);

      expect(run.failFast).toBe(false);
    });

    it("applies the fail-fast override", () => {
      const run = EvalRun.forProject(tmpdir, config, { failFast: true });

      expect(run.failFast).toBe(true);
    });

    it("judges with the configured judges when none are overridden", async () => {
      useCompliantFixture();
      const run = EvalRun.forProject(tmpdir, config, { useCache: false });
      const results = await run.validateAll();
      const judgeNames = [...new Set(results.map((r) => r.judge))];

      expect(judgeNames).toEqual(config.judges.map((j) => j.name));
    });

    it("judges with only the overridden judges", async () => {
      useCompliantFixture();
      const only = config.judges.slice(0, 1);
      const run = EvalRun.forProject(tmpdir, config, { judges: only, useCache: false });
      const results = await run.validateAll();
      const judgeNames = [...new Set(results.map((r) => r.judge))];

      expect(judgeNames).toEqual(only.map((j) => j.name));
    });
  });

  describe("validateAll()", () => {
    it("validates documents across all types", async () => {
      useCompliantFixture();

      const run = new EvalRun({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        judges: [TEST_JUDGE],
      });

      const results = await run.validateAll();

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.compliant)).toBe(true);
    });
  });

  describe("validateType()", () => {
    it("validates only documents of the specified type", async () => {
      useCompliantFixture();

      const run = new EvalRun({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        judges: [TEST_JUDGE],
      });
      const results = await run.validateType("experts");

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.type.includes("experts"))).toBe(true);
    });

    it("throws for unknown document type", async () => {
      const run = new EvalRun({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        judges: [TEST_JUDGE],
      });

      await expect(run.validateType("bogus")).rejects.toThrow("Unknown document type: bogus");
    });
  });

  describe("fail-fast", () => {
    it("stops on first error when fail-fast is enabled", async () => {
      useErrorFixture();

      const run = new EvalRun({
        root: tmpdir,
        sources: config.sources,
        failFast: true,
        useCache: false,
        judges: [TEST_JUDGE],
      });

      await run.validateAll();

      expect(run.stopped).toBe(true);
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
        specFilePattern: "SPEC.md",
      });

      const run = new EvalRun({
        root,
        sources: ["roles"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "SPEC.md",
      });

      const results = await run.validateAll();

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

      const run = new EvalRun({
        root,
        sources: ["specs", "docs"],
        useCache: false,
        judges: [TEST_JUDGE],
      });

      const results = await run.validateAll();
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

      const run = new EvalRun({
        root,
        sources: ["specs", "docs"],
        useCache: false,
        judges: [TEST_JUDGE],
      });

      const results = await run.validateAll();
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

      const run = new EvalRun({
        root,
        sources: ["roles"],
        useCache: false,
        judges: [TEST_JUDGE],
      });

      const results = await run.validateAll();

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

      const run = new EvalRun({
        root,
        sources: ["docs"],
        ignore: ["docs/smes/**"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

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

      const run = new EvalRun({
        root,
        sources: ["docs"],
        ignore: ["docs/smes/**"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

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

      const run = new EvalRun({
        root,
        sources: ["docs"],
        ignore: ["docs/generated/**"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.praxis.md",
      });

      const docs = run["collectSourceDocuments"]();
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

      const run = new EvalRun({
        root,
        sources: ["docs"],
        ignore: ["docs/ignored/**"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.praxis.md",
      });

      const results = await run.validateAll();

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
        specFilePattern: "*.sme.md",
      });
    }

    it("judges each matched directory as one evaluation unit", async () => {
      useCompliantFixture();
      const { root, cleanup } = cohortProject();

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

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

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await run.validateAll();

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

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await run.validateAll();

      const alphaBody = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(alphaBody).toContain("src/services/alpha/a.ts");

      cleanup();
    });

    it("caches per cohort and invalidates when any member changes", async () => {
      useCompliantFixture();
      const { root, abs, cleanup } = cohortProject();

      function makeRun() {
        return new EvalRun({
          root,
          sources: ["docs"],
          judges: [TEST_JUDGE],
          specFilePattern: "*.sme.md",
        });
      }

      const first = makeRun();
      await first.validateAll();
      expect(first.cacheStats).toEqual({ hits: 0, misses: 2 });

      const second = makeRun();
      await second.validateAll();
      expect(second.cacheStats).toEqual({ hits: 2, misses: 0 });

      writeFileSync(abs("src/services/alpha/a.ts"), "ALPHA_A_EDITED");

      const third = makeRun();
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
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

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
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await expect(run.validateAll()).rejects.toThrow('Invalid cohort value "by_magic"');

      cleanup();
    });
  });

  describe("excludes frontmatter", () => {
    it("never validates a file the spec excludes from paths targeting", async () => {
      useCompliantFixture();

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/events.sme.md": [
            "---",
            "paths:",
            '  - "src/events/*.rb"',
            "excludes:",
            '  - "src/events/application_event.rb"',
            "---",
            "# Events Spec",
          ].join("\n"),
          "src/events/application_event.rb": "class ApplicationEvent; end",
          "src/events/referral_event.rb": "class ReferralEvent < ApplicationEvent; end",
        },
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

      expect(results.map((r) => r.filename)).toEqual(["referral_event.rb"]);

      cleanup();
    });

    it("never validates an excluded sibling document when the spec has no paths", async () => {
      useCompliantFixture();

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/README.md": '---\nexcludes:\n  - "docs/legacy.md"\n---\n# Docs Spec',
          "docs/good.md": "# Good",
          "docs/legacy.md": "# Legacy — structurally out of scope",
        },
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
      });

      const results = await run.validateAll();

      expect(results.map((r) => r.filename)).toEqual(["good.md"]);

      cleanup();
    });

    it("keeps excluded files out of cohort membership", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
          );
        }),
      );

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/services.sme.md": [
            "---",
            "paths:",
            '  - "src/services/*"',
            "cohort: by_directory",
            "excludes:",
            '  - "src/services/alpha/generated.ts"',
            "---",
            "# Service Spec",
          ].join("\n"),
          "src/services/alpha/a.ts": "ALPHA_A_CONTENT",
          "src/services/alpha/generated.ts": "GENERATED_CONTENT",
        },
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await run.validateAll();

      const alphaBody = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(alphaBody).toBeDefined();
      expect(alphaBody).not.toContain("GENERATED_CONTENT");

      cleanup();
    });

    it("yields no unit for an excluded directory under cohort: by_directory", async () => {
      useCompliantFixture();

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/services.sme.md": [
            "---",
            "paths:",
            '  - "src/services/*"',
            "cohort: by_directory",
            "excludes:",
            '  - "src/services/beta"',
            "---",
            "# Service Spec",
          ].join("\n"),
          "src/services/alpha/a.ts": "ALPHA_A_CONTENT",
          "src/services/beta/c.ts": "BETA_C_CONTENT",
        },
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

      expect(results.map((r) => r.filename)).toEqual(["alpha"]);

      cleanup();
    });
  });

  describe("exemplars frontmatter", () => {
    /** A spec blessing one of its two targets as a positive example. */
    function exemplarProject() {
      return createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/events.sme.md": [
            "---",
            "paths:",
            '  - "src/events/*.rb"',
            "exemplars:",
            '  - "src/events/referral_event.rb"',
            "---",
            "# Events Spec",
          ].join("\n"),
          "src/events/referral_event.rb": "REFERRAL_EXEMPLAR_CONTENT",
          "src/events/signup_event.rb": "SIGNUP_CONTENT",
        },
        specFilePattern: "*.sme.md",
      });
    }

    it("never issues a verdict for an exemplar file", async () => {
      useCompliantFixture();
      const { root, cleanup } = exemplarProject();

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

      expect(results.map((r) => r.filename)).toEqual(["signup_event.rb"]);

      cleanup();
    });

    it("inlines exemplars into the judgment request as labeled positives", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
          );
        }),
      );
      const { root, cleanup } = exemplarProject();

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await run.validateAll();

      const body = bodies.find((b) => b.includes("SIGNUP_CONTENT"));
      expect(body).toContain("EXEMPLAR: src/events/referral_event.rb");
      expect(body).toContain("REFERRAL_EXEMPLAR_CONTENT");

      cleanup();
    });

    it("keeps exemplars out of cohort membership while still showing them", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
          );
        }),
      );

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/services.sme.md": [
            "---",
            "paths:",
            '  - "src/services/*"',
            "cohort: by_directory",
            "exemplars:",
            '  - "src/services/alpha/golden.ts"',
            "---",
            "# Service Spec",
          ].join("\n"),
          "src/services/alpha/a.ts": "ALPHA_A_CONTENT",
          "src/services/alpha/golden.ts": "GOLDEN_CONTENT",
        },
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await run.validateAll();

      const body = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(body).toContain("EXEMPLAR: src/services/alpha/golden.ts");
      expect(body).not.toContain("FILE: src/services/alpha/golden.ts");

      cleanup();
    });
  });

  describe("context frontmatter", () => {
    it("inlines context files into every unit's judgment request, never judging them", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fully compliant." }),
          );
        }),
      );

      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/events.sme.md": [
            "---",
            "paths:",
            '  - "src/events/*.rb"',
            "context:",
            '  - "src/services/*.ts"',
            "---",
            "# Events Spec",
          ].join("\n"),
          "src/events/signup_event.rb": "SIGNUP_CONTENT",
          "src/events/referral_event.rb": "REFERRAL_CONTENT",
          "src/services/store.ts": "STORE_CONTEXT_CONTENT",
        },
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      const results = await run.validateAll();

      expect(results.map((r) => r.filename).sort()).toEqual([
        "referral_event.rb",
        "signup_event.rb",
      ]);
      expect(bodies).toHaveLength(2);

      for (const body of bodies) {
        expect(body).toContain("CONTEXT: src/services/store.ts");
        expect(body).toContain("STORE_CONTEXT_CONTENT");
      }

      cleanup();
    });
  });

  describe("multiple judges", () => {
    const flash = { name: "flash", model: "flash-model", apiKeyEnvVar: "OPENROUTER_API_KEY" };
    const strict = { name: "strict", model: "strict-model", apiKeyEnvVar: "OPENROUTER_API_KEY" };

    /** One target, one spec — the simplest fan-out fixture. */
    function twoJudgeProject() {
      return createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/README.md": "# Spec\nDocs need a title.",
          "docs/guide.md": "# Guide",
        },
      });
    }

    /** Responds per model: flash-model passes, strict-model fails. */
    function useSplitVerdicts(): void {
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          const body = (await request.json()) as { model: string };
          const response =
            body.model === "strict-model"
              ? validationToolCallResponse("validation_fail", {
                  reason: "Not good enough.",
                  issues: ["Too informal"],
                })
              : validationToolCallResponse("validation_pass", { reason: "Fine." });
          return HttpResponse.json(response);
        }),
      );
    }

    it("every judge evaluates every unit", async () => {
      useCompliantFixture();
      const { root, cleanup } = twoJudgeProject();

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [flash, strict],
      });

      const results = await run.validateAll();

      expect(results.map((r) => r.judge).sort()).toEqual(["flash", "strict"]);

      cleanup();
    });

    it("keeps each judge's verdicts in its own cache namespace", async () => {
      useCompliantFixture();
      const { root, cleanup } = twoJudgeProject();

      const first = new EvalRun({ root, sources: ["docs"], judges: [flash, strict] });
      await first.validateAll();
      expect(first.cacheStats).toEqual({ hits: 0, misses: 2 });

      const second = new EvalRun({ root, sources: ["docs"], judges: [flash, strict] });
      await second.validateAll();
      expect(second.cacheStats).toEqual({ hits: 2, misses: 0 });

      // A judge with different behavioral settings gets no hits from the others.
      const third = new EvalRun({
        root,
        sources: ["docs"],
        judges: [{ ...flash, name: "hot", temperature: 0.9 }],
      });
      await third.validateAll();
      expect(third.cacheStats).toEqual({ hits: 0, misses: 1 });

      cleanup();
    });

    it("a renamed judge keeps its cache hits — the name is not identity", async () => {
      useCompliantFixture();
      const { root, cleanup } = twoJudgeProject();

      const first = new EvalRun({ root, sources: ["docs"], judges: [flash] });
      await first.validateAll();

      const renamed = new EvalRun({
        root,
        sources: ["docs"],
        judges: [{ ...flash, name: "renamed" }],
      });
      await renamed.validateAll();

      expect(renamed.cacheStats).toEqual({ hits: 1, misses: 0 });

      cleanup();
    });

    it("summarizes per judge, never pooling silently", async () => {
      useSplitVerdicts();
      const { root, cleanup } = twoJudgeProject();

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [flash, strict],
      });

      await run.validateAll();
      const summary = run.summary();

      expect(summary.byJudge).toEqual({
        flash: { compliant: 1, warnings: 0, errors: 0 },
        strict: { compliant: 0, warnings: 0, errors: 1 },
      });

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
        specFilePattern: "*.sme.md",
      });

      const run = new EvalRun({
        root,
        sources: ["docs"],
        useCache: false,
        judges: [TEST_JUDGE],
        specFilePattern: "*.sme.md",
      });

      await run.validateAll();
      const summary = run.summary();

      // Three validated targets outnumber the zero .md source docs;
      // the totals must reflect the targets, never a negative remainder.
      expect(summary.total).toBe(3);
      expect(summary.compliant).toBe(3);
      expect(summary.notValidated).toBe(0);

      cleanup();
    });

    it("aggregates results correctly", async () => {
      useCompliantFixture();

      const run = new EvalRun({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        judges: [TEST_JUDGE],
      });
      await run.validateAll();
      const summary = run.summary();

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.compliant).toBe(summary.total);
      expect(summary.errors).toBe(0);
      expect(summary.warnings).toBe(0);
    });
  });
});
