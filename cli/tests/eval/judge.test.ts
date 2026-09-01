import { HttpResponse, http } from "msw";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir as osTmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CacheManager } from "@/eval/cache-manager.js";
import { Judge } from "@/eval/judge.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import {
  OPENROUTER_URL,
  TEST_JUDGE,
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

/** Canned tool-call responses used across the validate() tests. */
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

describe("Judge", () => {
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

  /** Builds a judge invocation for the standard fixture expert. */
  function makeValidator(): Judge {
    return new Judge({
      targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
      useCache: false,
      config: TEST_JUDGE,
    });
  }

  describe("validate()", () => {
    it("returns compliant result for a validation_pass tool call", async () => {
      useOpenRouterResponse(server, fixtures.pass);

      const result = await makeValidator().validate();

      expect(result.compliant).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("returns warning result for a validation_warn tool call", async () => {
      useOpenRouterResponse(server, fixtures.warn);

      const result = await makeValidator().validate();

      expect(result.compliant).toBe(false);
      expect(result.severity).toBe("warning");
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("returns error result for a validation_fail tool call", async () => {
      useOpenRouterResponse(server, fixtures.fail);

      const result = await makeValidator().validate();

      expect(result.compliant).toBe(false);
      expect(result.severity).toBe("error");
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("returns structured issues from the tool call response", async () => {
      useOpenRouterResponse(server, fixtures.fail);

      const result = await makeValidator().validate();

      expect(result.issues).toContain("Missing required `owner` field in frontmatter");
      expect(result.issues).toContain("Missing Objective section");
      expect(result.issues).toContain("Missing Criteria section");
    });

    it("throws when no judge is configured", async () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
      });

      await expect(validator.validate()).rejects.toThrow("No judges configured");
    });

    it("throws when the API key environment variable is not set", async () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
        config: { name: "unset", model: "m", apiKeyEnvVar: "UNSET_KEY_VAR" },
      });

      await expect(validator.validate()).rejects.toThrow(
        "UNSET_KEY_VAR environment variable not set",
      );
    });

    it("uses custom apiKeyEnvVar", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      process.env["CUSTOM_API_KEY"] = "test-key";

      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
        config: { name: "custom", model: "m", apiKeyEnvVar: "CUSTOM_API_KEY" },
      });

      const result = await validator.validate();
      expect(result.compliant).toBe(true);

      delete process.env["CUSTOM_API_KEY"];
    });

    it("throws with status and body when the API responds with an error", async () => {
      server.use(
        http.post(OPENROUTER_URL, () => HttpResponse.text("upstream unavailable", { status: 502 })),
      );

      await expect(makeValidator().validate()).rejects.toThrow(
        'Judge provider "openrouter" API error (502): upstream unavailable',
      );
    });

    it("throws when the model returns no tool call", async () => {
      useOpenRouterResponse(server, {
        choices: [{ message: { role: "assistant", content: "Looks fine to me." } }],
      });

      await expect(makeValidator().validate()).rejects.toThrow("did not return a tool call");
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

      await expect(makeValidator().validate()).rejects.toThrow(
        "Unexpected validation tool call: validation_bogus",
      );
    });
  });

  describe("judge settings", () => {
    it("sends the request to the judge's baseUrl", async () => {
      let hit = false;
      server.use(
        http.post("https://inference.internal/v1/chat/completions", () => {
          hit = true;
          return HttpResponse.json(fixtures.pass);
        }),
      );

      const judge = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
        config: {
          name: "local",
          model: "org-model",
          apiKeyEnvVar: "OPENROUTER_API_KEY",
          baseUrl: "https://inference.internal/v1",
        },
      });
      await judge.validate();

      expect(hit).toBe(true);
    });

    it("sends the judge's temperature, defaulting to 0", async () => {
      const temperatures: number[] = [];
      server.use(
        http.post(OPENROUTER_URL, async ({ request }) => {
          const body = (await request.json()) as { temperature: number };
          temperatures.push(body.temperature);
          return HttpResponse.json(fixtures.pass);
        }),
      );
      const targetPath = join(tmpdir, "content", "experts", "test-expert.md");

      await new Judge({
        targetPath,
        useCache: false,
        config: { name: "hot", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY", temperature: 0.9 },
      }).validate();
      await new Judge({
        targetPath,
        useCache: false,
        config: { name: "cool", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" },
      }).validate();

      expect(temperatures).toEqual([0.9, 0]);
    });
  });

  describe("custom specFilePattern", () => {
    it("finds spec file by exact custom name", () => {
      const dir = join(osTmpdir(), `praxis-spec-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SPEC.md"), "# Spec\nRequired fields: name");
      writeFileSync(join(dir, "doc.md"), "---\ntype: role\n---\n# Doc");

      const validator = new Judge({
        targetPath: join(dir, "doc.md"),
        specFilePattern: "SPEC.md",
        useCache: false,
      });

      expect(validator.specPath).toBe(join(dir, "SPEC.md"));

      rmSync(dir, { recursive: true, force: true });
    });

    it("finds spec file by glob pattern", () => {
      const dir = join(osTmpdir(), `praxis-spec-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "README.roles.md"), "# Roles Spec");
      writeFileSync(join(dir, "doc.md"), "---\ntype: role\n---\n# Doc");

      const validator = new Judge({
        targetPath: join(dir, "doc.md"),
        specFilePattern: "README.*.md",
        useCache: false,
      });

      expect(validator.specPath).toBe(join(dir, "README.roles.md"));

      rmSync(dir, { recursive: true, force: true });
    });

    it("throws when custom spec file not found", () => {
      const dir = join(osTmpdir(), `praxis-spec-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "doc.md"), "---\ntype: role\n---\n# Doc");

      expect(
        () =>
          new Judge({
            targetPath: join(dir, "doc.md"),
            specFilePattern: "SPEC.md",
            useCache: false,
          }),
      ).toThrow("No SPEC.md found");

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("content hash", () => {
    it("returns 8-character hex string", () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
      });

      const hash = validator.getContentHash();

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

      const judge = new Judge({
        targetPath: abs("src/events/signup_event.rb"),
        specPath: abs("docs/events.sme.md"),
        root,
        useCache: false,
        config: TEST_JUDGE,
      });
      await judge.validate();

      expect(bodies[0]).toContain("EXEMPLAR: src/events/referral_event.rb");
      expect(bodies[0]).toContain("REFERRAL_EXEMPLAR_CONTENT");

      cleanup();
    });

    it("editing an exemplar invalidates the cached verdict", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      const { root, abs, cleanup } = exemplarProject();

      function makeJudge(): Judge {
        return new Judge({
          targetPath: abs("src/events/signup_event.rb"),
          specPath: abs("docs/events.sme.md"),
          root,
          cacheManager: new CacheManager({ projectRoot: root }),
          config: TEST_JUDGE,
        });
      }

      await makeJudge().validate();

      const second = makeJudge();
      await second.validate();
      expect(second.cacheHit).toBe(true);

      writeFileSync(abs("src/events/referral_event.rb"), "REFERRAL_EXEMPLAR_EDITED");

      const third = makeJudge();
      await third.validate();
      expect(third.cacheHit).toBe(false);

      cleanup();
    });

    it("throws when a spec declares exemplars and no project root is given", () => {
      const { abs, cleanup } = exemplarProject();

      expect(
        () =>
          new Judge({
            targetPath: abs("src/events/signup_event.rb"),
            specPath: abs("docs/events.sme.md"),
            useCache: false,
            config: TEST_JUDGE,
          }),
      ).toThrow(/project root/);

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

    /** Builds a cache-bound Judge for the context project. */
    function makeJudge(root: string, abs: (p: string) => string): Judge {
      return new Judge({
        targetPath: abs("src/events/signup_event.rb"),
        specPath: abs("docs/events.sme.md"),
        root,
        cacheManager: new CacheManager({ projectRoot: root }),
        config: TEST_JUDGE,
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

      const judge = new Judge({
        targetPath: abs("src/events/signup_event.rb"),
        specPath: abs("docs/events.sme.md"),
        root,
        useCache: false,
        config: TEST_JUDGE,
      });
      await judge.validate();

      expect(bodies[0]).toContain("CONTEXT: src/services/store.ts");
      expect(bodies[0]).toContain("STORE_CONTEXT_CONTENT");

      cleanup();
    });

    it("editing a context file invalidates the cached verdict", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      const { root, abs, cleanup } = contextProject();

      await makeJudge(root, abs).validate();

      const second = makeJudge(root, abs);
      await second.validate();
      expect(second.cacheHit).toBe(true);

      writeFileSync(abs("src/services/store.ts"), "STORE_CONTEXT_EDITED");

      const third = makeJudge(root, abs);
      await third.validate();
      expect(third.cacheHit).toBe(false);

      cleanup();
    });

    it("records the resolved context files with their hashes in the cache entry", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      const { root, abs, cleanup } = contextProject();

      await makeJudge(root, abs).validate();

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
        async judge() {
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
        async judge() {
          throw new Error("socket hang up");
        },
      };
    }
    `;

    it("judges through a local provider module with no HTTP call", async () => {
      // onUnhandledRequest: "error" makes any network attempt fail loudly.
      const { root, abs, cleanup } = providerProject(ECHO_PROVIDER);

      const judge = new Judge({
        targetPath: abs("docs/guide.md"),
        root,
        useCache: false,
        config: { ...TEST_JUDGE, provider: "./praxis-providers/echo.mjs" },
      });
      const result = await judge.validate();

      expect(result).toEqual({ compliant: true, issues: [], reason: "echoed" });

      cleanup();
    });

    it("exposes the provider's usage after a real call", async () => {
      const { root, abs, cleanup } = providerProject(ECHO_PROVIDER);

      const judge = new Judge({
        targetPath: abs("docs/guide.md"),
        root,
        useCache: false,
        config: { ...TEST_JUDGE, provider: "./praxis-providers/echo.mjs" },
      });
      await judge.validate();

      expect(judge.lastUsage).toEqual({ promptTokens: 7, completionTokens: 3, costUsd: 0.0001 });

      cleanup();
    });

    it("reports null usage for a cache hit", async () => {
      const { root, abs, cleanup } = providerProject(ECHO_PROVIDER);
      const judgeConfig = { ...TEST_JUDGE, provider: "./praxis-providers/echo.mjs" };

      function makeJudge(): Judge {
        return new Judge({
          targetPath: abs("docs/guide.md"),
          root,
          cacheManager: new CacheManager({ projectRoot: root }),
          config: judgeConfig,
        });
      }

      await makeJudge().validate();

      const second = makeJudge();
      await second.validate();

      expect(second.cacheHit).toBe(true);
      expect(second.lastUsage).toBeNull();

      cleanup();
    });

    it("wraps a provider's own failure with the provider's name", async () => {
      const { root, abs, cleanup } = providerProject(THROWING_PROVIDER);

      const judge = new Judge({
        targetPath: abs("docs/guide.md"),
        root,
        useCache: false,
        config: { ...TEST_JUDGE, provider: "./praxis-providers/echo.mjs" },
      });
      const judgment = judge.validate();

      await expect(judgment).rejects.toThrow('Judge provider "flaky" failed: socket hang up');

      cleanup();
    });
  });

  describe("caching", () => {
    it("uses cached result on second call with same content", async () => {
      useOpenRouterResponse(server, fixtures.pass);

      const cacheManager = new CacheManager({
        cacheRoot: join(tmpdir, ".praxis", "cache", "validation"),
      });

      const validator1 = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        cacheManager,
        config: TEST_JUDGE,
      });
      await validator1.validate();
      expect(validator1.cacheHit).toBe(false);

      const validator2 = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        cacheManager,
        config: TEST_JUDGE,
      });
      await validator2.validate();
      expect(validator2.cacheHit).toBe(true);
    });
  });
});
