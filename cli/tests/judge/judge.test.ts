import { HttpResponse, http } from "msw";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir as osTmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CacheManager } from "@/judge/cache-manager.js";
import { Judge } from "@/judge/judge.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import {
  OPENROUTER_URL,
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";

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

  /** Builds a validator for the standard fixture role with API config supplied. */
  function makeValidator(): Judge {
    return new Judge({
      targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
      useCache: false,
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      model: "x-ai/grok-4.1-fast",
    });
  }

  describe("document type detection", () => {
    it("detects expert type from frontmatter", () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
      });

      expect(validator.targetType).toBe("expert");
    });

    it("detects practice type from frontmatter", () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "practices", "test-practice.md"),
        useCache: false,
      });

      expect(validator.targetType).toBe("practice");
    });

    it("maps deprecated v1 type values to their v2 names", () => {
      const dir = join(osTmpdir(), `praxis-legacy-type-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "README.md"), "# Spec");
      writeFileSync(join(dir, "old-role.md"), "---\ntype: role\n---\n# Old");
      writeFileSync(join(dir, "old-resp.md"), "---\ntype: responsibility\n---\n# Old");

      const roleTyped = new Judge({ targetPath: join(dir, "old-role.md"), useCache: false });
      const respTyped = new Judge({ targetPath: join(dir, "old-resp.md"), useCache: false });

      expect(roleTyped.targetType).toBe("expert");
      expect(respTyped.targetType).toBe("practice");

      rmSync(dir, { recursive: true, force: true });
    });

    it("infers expert type from a legacy /roles/ path", () => {
      const dir = join(osTmpdir(), `praxis-legacy-dir-${randomUUID()}`);
      mkdirSync(join(dir, "roles"), { recursive: true });
      writeFileSync(join(dir, "roles", "README.md"), "# Spec");
      writeFileSync(join(dir, "roles", "untyped.md"), "# No frontmatter");

      const judge = new Judge({ targetPath: join(dir, "roles", "untyped.md"), useCache: false });

      expect(judge.targetType).toBe("expert");

      rmSync(dir, { recursive: true, force: true });
    });

    it("detects template type from filename prefix", () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "context", "constitution", "_template.md"),
        useCache: false,
      });

      expect(validator.targetType).toBe("template");
    });

    it("infers type from path when no type in frontmatter", () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "README.md"),
        specPath: join(tmpdir, "content", "experts", "README.md"),
        useCache: false,
      });

      expect(validator.targetType).toBe("expert");
    });
  });

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

    it("throws when apiKeyEnvVar is not provided", async () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
      });

      await expect(validator.validate()).rejects.toThrow("apiKeyEnvVar");
    });

    it("throws when the API key environment variable is not set", async () => {
      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
        apiKeyEnvVar: "UNSET_KEY_VAR",
        model: "x-ai/grok-4.1-fast",
      });

      await expect(validator.validate()).rejects.toThrow(
        "UNSET_KEY_VAR environment variable not set",
      );
    });

    it("throws when model is not provided", async () => {
      process.env["MY_KEY"] = "test-key";

      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
        apiKeyEnvVar: "MY_KEY",
      });

      await expect(validator.validate()).rejects.toThrow("model");

      delete process.env["MY_KEY"];
    });

    it("uses custom apiKeyEnvVar", async () => {
      useOpenRouterResponse(server, fixtures.pass);
      process.env["CUSTOM_API_KEY"] = "test-key";

      const validator = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        useCache: false,
        apiKeyEnvVar: "CUSTOM_API_KEY",
        model: "x-ai/grok-4.1-fast",
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
        "OpenRouter API error (502): upstream unavailable",
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

  describe("caching", () => {
    it("uses cached result on second call with same content", async () => {
      useOpenRouterResponse(server, fixtures.pass);

      const cacheManager = new CacheManager(join(tmpdir, ".praxis", "cache", "validation"));

      const validator1 = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        cacheManager,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      await validator1.validate();
      expect(validator1.cacheHit).toBe(false);

      const validator2 = new Judge({
        targetPath: join(tmpdir, "content", "experts", "test-expert.md"),
        cacheManager,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      await validator2.validate();
      expect(validator2.cacheHit).toBe(true);
    });
  });
});
