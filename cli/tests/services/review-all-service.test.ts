import type { LedgerRecord } from "@/types.js";

import { HttpResponse, http } from "msw";
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import listSourceDocumentsService from "@/services/list-source-documents-service.js";
import reviewAllService from "@/services/review-all-service.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import {
  OPENROUTER_URL,
  TEST_REVIEWER,
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

describe("reviewAllService", () => {
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

  describe("reviewers", () => {
    it("reviewers with every reviewer it is given", async () => {
      useCompliantFixture();
      const run = await reviewAllService({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        reviewers: config.reviewers,
      });
      const reviewerNames = [...new Set(run.verdicts.map((r) => r.reviewer))];

      expect(reviewerNames).toEqual(config.reviewers.map((j) => j.name));
    });

    it("reviewers with only the reviews it is given", async () => {
      useCompliantFixture();
      const only = config.reviewers.slice(0, 1);
      const run = await reviewAllService({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        reviewers: only,
      });
      const reviewerNames = [...new Set(run.verdicts.map((r) => r.reviewer))];

      expect(reviewerNames).toEqual(only.map((j) => j.name));
    });
  });

  describe("a full run over the sources", () => {
    it("validates documents across all types", async () => {
      useCompliantFixture();

      const run = await reviewAllService({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });

      const results = run.verdicts;

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.compliant)).toBe(true);
    });
  });

  describe("type filter", () => {
    it("reviewers only documents of the specified type", async () => {
      useCompliantFixture();

      const run = await reviewAllService({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        reviewers: [TEST_REVIEWER],
        type: "experts",
      });

      expect(run.verdicts.length).toBeGreaterThan(0);
      expect(run.verdicts.every((r) => r.type.includes("experts"))).toBe(true);
    });

    it("throws for an unknown document type", async () => {
      const run = reviewAllService({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        reviewers: [TEST_REVIEWER],
        type: "bogus",
      });

      await expect(run).rejects.toThrow(
        /Unknown document type "bogus" — this project has: .*experts/,
      );
    });
  });

  describe("fail-fast", () => {
    it("stops on first error when fail-fast is enabled", async () => {
      useErrorFixture();

      const run = await reviewAllService({
        root: tmpdir,
        sources: config.sources,
        failFast: true,
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });

      expect(run.stoppedEarly).toBe(true);
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

      const run = await reviewAllService({
        root,
        sources: ["roles"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "SPEC.md",
      });

      const results = run.verdicts;

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

      const run = await reviewAllService({
        root,
        sources: ["specs", "docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });

      const results = run.verdicts;
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

      const run = await reviewAllService({
        root,
        sources: ["specs", "docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });

      const results = run.verdicts;
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

      const run = await reviewAllService({
        root,
        sources: ["roles"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });

      const results = run.verdicts;

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        absoluteIgnore: [join(root, "docs/smes/**")],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        absoluteIgnore: [join(root, "docs/smes/**")],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

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

      const docs = listSourceDocumentsService({
        root,
        sources: ["docs"],
        specFilePattern: "*.praxis.md",
        absoluteIgnore: [join(root, "docs/generated/**")],
      });

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        absoluteIgnore: [join(root, "docs/ignored/**")],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.praxis.md",
      });

      const results = run.verdicts;

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

    it("reviews each matched directory as one review unit", async () => {
      useCompliantFixture();
      const { root, cleanup } = cohortProject();

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

      expect(results.map((r) => r.filename).sort()).toEqual(["alpha", "beta"]);

      cleanup();
    });

    it("sends every member file in a single review request", async () => {
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

      await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

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

      await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const alphaBody = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(alphaBody).toContain("src/services/alpha/a.ts");

      cleanup();
    });

    it("caches per cohort and invalidates when any member changes", async () => {
      useCompliantFixture();
      const { root, abs, cleanup } = cohortProject();

      function makeRun() {
        return reviewAllService({
          root,
          sources: ["docs"],
          reviewers: [TEST_REVIEWER],
          specFilePattern: "*.sme.md",
        });
      }

      const first = await makeRun();
      expect(first.cacheStats).toEqual({ hits: 0, misses: 2 });

      const second = await makeRun();
      expect(second.cacheStats).toEqual({ hits: 2, misses: 0 });

      writeFileSync(abs("src/services/alpha/a.ts"), "ALPHA_A_EDITED");

      const third = await makeRun();
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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

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

      const run = reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      await expect(run).rejects.toThrow(
        /Invalid "cohort" in docs\/services\.sme\.md .* expected "by_file" or "by_directory", got "by_magic"/,
      );

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });

      const results = run.verdicts;

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

      await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

      expect(results.map((r) => r.filename)).toEqual(["signup_event.rb"]);

      cleanup();
    });

    it("inlines exemplars into the review request as labeled positives", async () => {
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

      await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

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

      await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const body = bodies.find((b) => b.includes("ALPHA_A_CONTENT"));
      expect(body).toContain("EXEMPLAR: src/services/alpha/golden.ts");
      expect(body).not.toContain("FILE: src/services/alpha/golden.ts");

      cleanup();
    });
  });

  describe("context frontmatter", () => {
    it("inlines context files into every unit's review request, never reviewing them", async () => {
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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const results = run.verdicts;

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

  describe("multiple reviewers", () => {
    const flash = { name: "flash", model: "flash-model", apiKeyEnvVar: "OPENROUTER_API_KEY" };
    const strict = { name: "strict", model: "strict-model", apiKeyEnvVar: "OPENROUTER_API_KEY" };

    /** One target, one spec — the simplest fan-out fixture. */
    function twoReviewerProject() {
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

    it("every reviewer reviews every unit", async () => {
      useCompliantFixture();
      const { root, cleanup } = twoReviewerProject();

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [flash, strict],
      });

      const results = run.verdicts;

      expect(results.map((r) => r.reviewer).sort()).toEqual(["flash", "strict"]);

      cleanup();
    });

    it("keeps each reviewer's verdicts in its own cache namespace", async () => {
      useCompliantFixture();
      const { root, cleanup } = twoReviewerProject();

      const first = await reviewAllService({ root, sources: ["docs"], reviewers: [flash, strict] });
      expect(first.cacheStats).toEqual({ hits: 0, misses: 2 });

      const second = await reviewAllService({
        root,
        sources: ["docs"],
        reviewers: [flash, strict],
      });
      expect(second.cacheStats).toEqual({ hits: 2, misses: 0 });

      // A reviewer with different behavioral settings gets no hits from the others.
      const third = await reviewAllService({
        root,
        sources: ["docs"],
        reviewers: [{ ...flash, name: "hot", temperature: 0.9 }],
      });

      expect(third.cacheStats).toEqual({ hits: 0, misses: 1 });

      cleanup();
    });

    it("a renamed reviewer keeps its cache hits — the name is not identity", async () => {
      useCompliantFixture();
      const { root, cleanup } = twoReviewerProject();

      await reviewAllService({ root, sources: ["docs"], reviewers: [flash] });

      const renamed = await reviewAllService({
        root,
        sources: ["docs"],
        reviewers: [{ ...flash, name: "renamed" }],
      });

      expect(renamed.cacheStats).toEqual({ hits: 1, misses: 0 });

      cleanup();
    });

    it("summarizes per reviewer, never pooling silently", async () => {
      useSplitVerdicts();
      const { root, cleanup } = twoReviewerProject();

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [flash, strict],
      });

      const summary = run.summary;

      expect(summary.byReviewer).toEqual({
        flash: { compliant: 1, warnings: 0, errors: 0 },
        strict: { compliant: 0, warnings: 0, errors: 1 },
      });

      cleanup();
    });
  });

  describe("the run summary", () => {
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

      const run = await reviewAllService({
        root,
        sources: ["docs"],
        useCache: false,
        reviewers: [TEST_REVIEWER],
        specFilePattern: "*.sme.md",
      });

      const summary = run.summary;

      // Three validated targets outnumber the zero .md source docs;
      // the totals must reflect the targets, never a negative remainder.
      expect(summary.total).toBe(3);
      expect(summary.compliant).toBe(3);
      expect(summary.notValidated).toBe(0);

      cleanup();
    });

    it("aggregates results correctly", async () => {
      useCompliantFixture();

      const run = await reviewAllService({
        root: tmpdir,
        sources: config.sources,
        useCache: false,
        reviewers: [TEST_REVIEWER],
      });
      const summary = run.summary;

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.compliant).toBe(summary.total);
      expect(summary.errors).toBe(0);
      expect(summary.warnings).toBe(0);
    });
  });
});

describe("the ledger", () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
    delete process.env["OPENROUTER_API_KEY"];
  });

  /** Every .jsonl run file under the project's ledger, parsed. */
  function ledgerRuns(root: string): { file: string; records: LedgerRecord[] }[] {
    const dir = join(root, ".praxis", "ledger", "runs");

    if (!existsSync(dir)) return [];

    return readdirSync(dir)
      .sort()
      .map((file) => ({
        file,
        records: readFileSync(join(dir, file), "utf8")
          .trimEnd()
          .split("\n")
          .map((line) => JSON.parse(line) as LedgerRecord),
      }));
  }

  const FLASH = { name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" };

  /** A throwaway two-target project with one keyed reviewer. */
  function ledgerProject(): { root: string } {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        "docs/README.md": "# Spec\nDocs need a title.",
        "docs/guide.md": "# Guide",
        "docs/other.md": "# Other",
      },
      reviewers: [FLASH],
    });
    cleanups.push(cleanup);
    process.env["OPENROUTER_API_KEY"] = "test-key";

    return { root };
  }

  it("persists one run file per reviewer, critiques matching the issues found", async () => {
    useErrorFixture();
    const { root } = ledgerProject();

    await reviewAllService({ root, sources: ["docs"], reviewers: [FLASH], useCache: false });

    const runs = ledgerRuns(root);

    expect(runs).toHaveLength(1);

    const [run, ...critiques] = runs[0].records;

    expect(run).toMatchObject({ kind: "run", scope: "corpus", trigger: "manual" });
    // Two targets, two issues each (the error fixture reports two).
    expect(critiques.every((record) => record.kind === "critique")).toBe(true);
    expect(critiques.length).toBeGreaterThan(0);
    expect((run as { critique_count: number }).critique_count).toBe(critiques.length);
  });

  it("writes a fresh run file for an all-hit run, counting hits and no critiques", async () => {
    useErrorFixture();
    const { root } = ledgerProject();

    await reviewAllService({ root, sources: ["docs"], reviewers: [FLASH] });
    await reviewAllService({ root, sources: ["docs"], reviewers: [FLASH] });

    const runs = ledgerRuns(root);

    expect(runs).toHaveLength(2);

    const second = runs[1].records;
    const run = second[0] as { cache_hits: number; critique_count: number; prompt_tokens: null };

    expect(run.cache_hits).toBeGreaterThan(0);
    expect(run.critique_count).toBe(0);
    expect(run.prompt_tokens).toBeNull();
    expect(second).toHaveLength(1);
  });

  it("writes nothing when ledger is false — CI verifies without writing (12)", async () => {
    useCompliantFixture();
    const { root } = ledgerProject();

    await reviewAllService({
      root,
      sources: ["docs"],
      reviewers: [FLASH],
      useCache: false,
      ledger: false,
    });

    expect(ledgerRuns(root)).toEqual([]);
  });

  it("records an unreadable target as unverified: counted, excluded, no critiques", async () => {
    useCompliantFixture();
    const { root } = ledgerProject();
    rmSync(join(root, "docs", "other.md"));
    writeFileSync(join(root, "docs", "other.md"), "");
    chmodSync(join(root, "docs", "other.md"), 0o000);

    const run = await reviewAllService({
      root,
      sources: ["docs"],
      reviewers: [FLASH],
      useCache: false,
    });

    chmodSync(join(root, "docs", "other.md"), 0o644);

    expect(run.summary.unverified).toBe(1);
    expect(run.summary.errors).toBe(0);

    const [runRecord, ...critiques] = ledgerRuns(root)[0].records;

    expect((runRecord as { unverified_count: number }).unverified_count).toBe(1);
    expect(
      critiques.filter((c) => (c as { file_path?: string }).file_path?.includes("other")),
    ).toEqual([]);
  });
});
