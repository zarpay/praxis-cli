import type { ReviewerConfig } from "@/types.js";

import { HttpResponse, http } from "msw";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import reviewTargetService from "@/services/review-target-service.js";
import { SpecStore } from "@/stores/spec-store.js";
import { VerdictStore } from "@/stores/verdict-store.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import {
  OPENROUTER_URL,
  TEST_REVIEWER,
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

/** Canned tool-call responses used across the reviewing tests. */
const fixtures = {
  pass: validationToolCallResponse("validation_pass", {
    reason: "The file satisfies all criteria defined in the specification.",
  }),
  warn: validationToolCallResponse("validation_warn", {
    reason: "Minor deviations from the specification.",
    issues: ["Missing optional `schedule` field", "Description could be more detailed"],
  }),
  fail: validationToolCallResponse("validation_fail", {
    reason: "Required criteria are not met.",
    issues: [
      "Missing required `owner` field in frontmatter",
      "Missing Objective section",
      "Missing Criteria section",
    ],
  }),
};

const server = createOpenRouterServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("reviewTargetService", () => {
  let tmpdir: string;
  let cleanup: () => void;

  beforeAll(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;
    process.env["OPENROUTER_API_KEY"] = "test-key";
  });

  afterAll(() => {
    cleanup();
    delete process.env["OPENROUTER_API_KEY"];
  });

  /** Evaluates one target with one reviewer, cache off unless given. */
  function evaluate({
    targetPath,
    specPath,
    specFilePattern,
    root,
    cfg = TEST_REVIEWER,
    cache = null,
  }: {
    targetPath?: string;
    specPath?: string;
    specFilePattern?: string;
    root?: string;
    cfg?: ReviewerConfig;
    cache?: VerdictStore | null;
  } = {}) {
    const projectConfig = testConfig(root ?? tmpdir, { specFilePattern });
    const resolvedTarget = targetPath ?? join(tmpdir, "content", "experts", "test-expert.md");
    const store = new SpecStore(projectConfig);
    const target = ReviewSubject.resolve({
      targetPath: resolvedTarget,
      specPath: specPath ?? store.governingPath(resolvedTarget),
      root,
    });

    return reviewTargetService(projectConfig, {
      target,
      reviewer: Reviewer.fromConfig(cfg),
      cache,
    });
  }

  describe("verdicts", () => {
    it("returns compliant result for a validation_pass tool call", async () => {
      useOpenRouterResponse(server, fixtures.pass);

      const { verdict } = await evaluate();

      expect(verdict.compliant).toBe(true);
      expect(verdict.issues).toEqual([]);
    });

    it("returns warning result for a validation_warn tool call", async () => {
      useOpenRouterResponse(server, fixtures.warn);

      const { verdict } = await evaluate();

      expect(verdict.compliant).toBe(false);
      expect(verdict.severity).toBe("warning");
      expect(verdict.issues.length).toBeGreaterThan(0);
    });

    it("returns error result for a validation_fail tool call", async () => {
      useOpenRouterResponse(server, fixtures.fail);

      const { verdict } = await evaluate();

      expect(verdict.compliant).toBe(false);
      expect(verdict.severity).toBe("error");
      expect(verdict.issues.length).toBeGreaterThan(0);
    });

    it("returns structured issues from the tool call response", async () => {
      useOpenRouterResponse(server, fixtures.fail);

      const { verdict } = await evaluate();

      const issueTexts = verdict.issues.map((issue) => issue.text);

      expect(issueTexts).toContain("Missing required `owner` field in frontmatter");
      expect(issueTexts).toContain("Missing Objective section");
      expect(issueTexts).toContain("Missing Criteria section");
    });

    it("throws when the API key environment variable is not set", async () => {
      const review = evaluate({
        cfg: { name: "unset", model: "m", apiKeyEnvVar: "UNSET_KEY_VAR" },
      });

      await expect(review).rejects.toThrow("UNSET_KEY_VAR environment variable not set");
    });

    it("uses custom apiKeyEnvVar", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      process.env["CUSTOM_API_KEY"] = "test-key";

      const { verdict } = await evaluate({
        cfg: { name: "custom", model: "m", apiKeyEnvVar: "CUSTOM_API_KEY" },
      });

      expect(verdict.compliant).toBe(true);

      delete process.env["CUSTOM_API_KEY"];
    });

    it("throws with status and body when the API responds with an error", async () => {
      server.use(
        http.post(OPENROUTER_URL, () => HttpResponse.text("upstream unavailable", { status: 502 })),
      );

      await expect(evaluate()).rejects.toThrow(
        'Reviewer provider "openrouter" API error (502): upstream unavailable',
      );
    });

    it("throws when the model returns no tool call", async () => {
      useOpenRouterResponse(server, {
        choices: [{ message: { role: "assistant", content: "Looks fine to me." } }],
      });

      await expect(evaluate()).rejects.toThrow("did not return a tool call");
    });

    it("throws when the model calls an unknown tool", async () => {
      useOpenRouterResponse(server, {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_bogus",
                  type: "function",
                  function: {
                    name: "validation_bogus",
                    arguments: JSON.stringify({ reason: "?" }),
                  },
                },
              ],
            },
          },
        ],
      });

      await expect(evaluate()).rejects.toThrow("Unexpected validation tool call: validation_bogus");
    });
  });

  describe("reviewer settings", () => {
    it("sends the request to the reviewer's baseUrl", async () => {
      let hit = false;
      server.use(
        http.post("https://inference.internal/v1/chat/completions", () => {
          hit = true;
          return HttpResponse.json(fixtures.pass);
        }),
      );

      await evaluate({
        cfg: {
          name: "local",
          model: "org-model",
          apiKeyEnvVar: "OPENROUTER_API_KEY",
          baseUrl: "https://inference.internal/v1",
        },
      });

      expect(hit).toBe(true);
    });

    it("sends the reviewer's temperature, defaulting to 0", async () => {
      const temperatures: number[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          const body = (await request.json()) as { temperature: number };
          temperatures.push(body.temperature);
          return HttpResponse.json(fixtures.pass);
        }),
      );

      await evaluate({
        cfg: { name: "hot", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY", temperature: 0.9 },
      });
      await evaluate({ cfg: { name: "cool", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" } });

      expect(temperatures).toEqual([0.9, 0]);
    });
  });

  describe("content hash", () => {
    it("returns 8-character hex string", () => {
      const targetPath = join(tmpdir, "content", "experts", "test-expert.md");
      const target = ReviewSubject.resolve({
        targetPath,
        specPath: new SpecStore(testConfig(tmpdir)).governingPath(targetPath),
      });
      const hash = target.contentHash();

      expect(hash).toHaveLength(8);
      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe("exemplars", () => {
    /** A single-target project whose spec blesses one exemplar. */
    function exemplarProject() {
      return createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/events.sme.md": [
            "---",
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

    it("resolves spec-declared exemplars from the project root into the prompt", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(fixtures.pass);
        }),
      );
      const { root, abs, cleanup } = exemplarProject();

      await evaluate({
        targetPath: abs("src/events/signup_event.rb"),
        specPath: abs("docs/events.sme.md"),
        root,
      });

      expect(bodies[0]).toContain("EXEMPLAR: src/events/referral_event.rb");
      expect(bodies[0]).toContain("REFERRAL_EXEMPLAR_CONTENT");

      cleanup();
    });

    it("editing an exemplar invalidates the cached verdict", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      const { root, abs, cleanup } = exemplarProject();

      const reviewed = () =>
        evaluate({
          targetPath: abs("src/events/signup_event.rb"),
          specPath: abs("docs/events.sme.md"),
          root,
          cache: new VerdictStore(testConfig(root)),
        });

      await reviewed();

      expect((await reviewed()).cacheHit).toBe(true);

      writeFileSync(abs("src/events/referral_event.rb"), "REFERRAL_EXEMPLAR_EDITED");

      expect((await reviewed()).cacheHit).toBe(false);

      cleanup();
    });

    it("throws when a spec declares exemplars and no project root is given", () => {
      const { abs, cleanup } = exemplarProject();

      const resolve = () =>
        ReviewSubject.resolve({
          targetPath: abs("src/events/signup_event.rb"),
          specPath: abs("docs/events.sme.md"),
        });

      expect(resolve).toThrow(/project root/);

      cleanup();
    });
  });

  describe("context", () => {
    /** A single-target project whose spec declares assist-only context. */
    function contextProject() {
      return createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/events.sme.md": [
            "---",
            "context:",
            '  - "src/services/*.ts"',
            "---",
            "# Events Spec",
          ].join("\n"),
          "src/services/store.ts": "STORE_CONTEXT_CONTENT",
          "src/events/signup_event.rb": "SIGNUP_CONTENT",
        },
        specFilePattern: "*.sme.md",
      });
    }

    /** Evaluates the context project's target against a cache. */
    function reviewContext(root: string, abs: (p: string) => string) {
      return evaluate({
        targetPath: abs("src/events/signup_event.rb"),
        specPath: abs("docs/events.sme.md"),
        root,
        cache: new VerdictStore(testConfig(root)),
      });
    }

    it("inlines spec-declared context files into the prompt as assist-only", async () => {
      const bodies: string[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(fixtures.pass);
        }),
      );
      const { root, abs, cleanup } = contextProject();

      await evaluate({
        targetPath: abs("src/events/signup_event.rb"),
        specPath: abs("docs/events.sme.md"),
        root,
      });

      expect(bodies[0]).toContain("CONTEXT: src/services/store.ts");
      expect(bodies[0]).toContain("STORE_CONTEXT_CONTENT");

      cleanup();
    });

    it("editing a context file invalidates the cached verdict", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      const { root, abs, cleanup } = contextProject();

      await reviewContext(root, abs);

      expect((await reviewContext(root, abs)).cacheHit).toBe(true);

      writeFileSync(abs("src/services/store.ts"), "STORE_CONTEXT_EDITED");

      expect((await reviewContext(root, abs)).cacheHit).toBe(false);

      cleanup();
    });

    it("records the resolved context files with their hashes in the cache entry", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      const { root, abs, cleanup } = contextProject();

      await reviewContext(root, abs);

      const cacheFile = abs(".praxis/cache/validation/src/events/signup_event.rb.json");
      const parsed = JSON.parse(readFileSync(cacheFile, "utf-8")) as {
        verdicts: Record<string, { context_files?: { path: string; hash: string }[] }>;
      };
      const entry = Object.values(parsed.verdicts)[0];

      expect(entry.context_files).toEqual([
        { path: "src/services/store.ts", hash: expect.stringMatching(/^[0-9a-f]{8}$/) as string },
      ]);

      cleanup();
    });
  });

  describe("providers", () => {
    /** A project with one spec-covered target and a local echo provider module. */
    function providerProject(providerSource: string) {
      return createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/README.md": "# Spec",
          "docs/guide.md": "# Guide",
          "praxis-providers/echo.mjs": providerSource,
        },
      });
    }

    const ECHO_PROVIDER = `export default function echoProvider() {
      return {
        name: "echo",
        async review() {
          return {
            verdict: { compliant: true, issues: [], reason: "echoed" },
            usage: { promptTokens: 7, completionTokens: 3, costUsd: 0.0001 },
          };
        },
      };
    }
    `;

    const THROWING_PROVIDER = `export default function throwingProvider() {
      return {
        name: "flaky",
        async review() {
          throw new Error("socket hang up");
        },
      };
    }
    `;

    const echoReviewer = { ...TEST_REVIEWER, provider: "./praxis-providers/echo.mjs" };

    it("reviews through a local provider module with no HTTP call", async () => {
      // onUnhandledRequest: "error" makes any network attempt fail loudly.
      const { root, abs, cleanup } = providerProject(ECHO_PROVIDER);

      const { verdict } = await evaluate({
        targetPath: abs("docs/guide.md"),
        root,
        cfg: echoReviewer,
      });

      expect(verdict).toEqual({ compliant: true, issues: [], reason: "echoed" });

      cleanup();
    });

    it("returns the provider's usage after a real call", async () => {
      const { root, abs, cleanup } = providerProject(ECHO_PROVIDER);

      const { usage } = await evaluate({
        targetPath: abs("docs/guide.md"),
        root,
        cfg: echoReviewer,
      });

      expect(usage).toEqual({ promptTokens: 7, completionTokens: 3, costUsd: 0.0001 });

      cleanup();
    });

    it("reports null usage for a cache hit — nothing was spent", async () => {
      const { root, abs, cleanup } = providerProject(ECHO_PROVIDER);

      const reviewed = () =>
        evaluate({
          targetPath: abs("docs/guide.md"),
          root,
          cfg: echoReviewer,
          cache: new VerdictStore(testConfig(root)),
        });

      await reviewed();
      const second = await reviewed();

      expect(second.cacheHit).toBe(true);
      expect(second.usage).toBeNull();

      cleanup();
    });

    it("wraps a provider's own failure with the provider's name", async () => {
      const { root, abs, cleanup } = providerProject(THROWING_PROVIDER);

      const review = evaluate({
        targetPath: abs("docs/guide.md"),
        root,
        cfg: echoReviewer,
      });

      await expect(review).rejects.toThrow('Reviewer provider "flaky" failed: socket hang up');

      cleanup();
    });
  });

  describe("caching", () => {
    it("uses cached result on second call with same content", async () => {
      useOpenRouterResponse(server, fixtures.pass);

      const cache = new VerdictStore(testConfig(tmpdir));
      const reviewed = () =>
        evaluate({ targetPath: join(tmpdir, "content", "experts", "test-expert.md"), cache });

      expect((await reviewed()).cacheHit).toBe(false);
      expect((await reviewed()).cacheHit).toBe(true);
    });
  });
});
