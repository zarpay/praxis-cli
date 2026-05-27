import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir as osTmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { DocumentValidator } from "@/validator/document-validator.js";
import { CacheManager } from "@/validator/cache-manager.js";

import { createCompilerTmpdir } from "../helpers/compiler-tmpdir.js";

/** MSW fixture responses for OpenRouter API calls. */
const fixtures = {
  compliant: {
    choices: [
      {
        message: {
          content:
            "Yes — the document complies with all requirements in the README specification.",
        },
      },
    ],
  },
  warning: {
    choices: [
      {
        message: {
          content:
            "Maybe — minor issues found:\n- Missing optional `schedule` field\n- Description could be more detailed",
        },
      },
    ],
  },
  error: {
    choices: [
      {
        message: {
          content:
            "No — major issues found:\n- Missing required `owner` field in frontmatter\n- Missing Objective section\n- Missing Criteria section",
        },
      },
    ],
  },
};

/** MSW server for intercepting OpenRouter API calls. */
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Registers an MSW handler that returns the given fixture for OpenRouter requests.
 */
function useFixture(fixtureName: keyof typeof fixtures): void {
  server.use(
    http.post("https://openrouter.ai/api/v1/chat/completions", () => {
      return HttpResponse.json(fixtures[fixtureName]);
    }),
  );
}

describe("DocumentValidator", () => {
  let tmpdir: string;
  let cleanup: () => void;

  beforeAll(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  describe("document type detection", () => {
    it("detects role type from frontmatter", () => {
      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
      });

      expect(validator.documentType).toBe("role");
    });

    it("detects responsibility type from frontmatter", () => {
      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "responsibilities", "test-responsibility.md"),
        useCache: false,
      });

      expect(validator.documentType).toBe("responsibility");
    });

    it("detects template type from filename prefix", () => {
      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "context", "constitution", "_template.md"),
        useCache: false,
      });

      expect(validator.documentType).toBe("template");
    });

    it("infers type from path when no type in frontmatter", () => {
      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "README.md"),
        specPath: join(tmpdir, "content", "roles", "README.md"),
        useCache: false,
      });

      expect(validator.documentType).toBe("role");
    });
  });

  describe("validate()", () => {
    it("returns compliant result for Yes response", async () => {
      useFixture("compliant");
      process.env["OPENROUTER_API_KEY"] = "test-key";

      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      const result = await validator.validate();

      expect(result.compliant).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("returns warning result for Maybe response", async () => {
      useFixture("warning");
      process.env["OPENROUTER_API_KEY"] = "test-key";

      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      const result = await validator.validate();

      expect(result.compliant).toBe(false);
      expect(result.severity).toBe("warning");
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("returns error result for No response", async () => {
      useFixture("error");
      process.env["OPENROUTER_API_KEY"] = "test-key";

      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      const result = await validator.validate();

      expect(result.compliant).toBe(false);
      expect(result.severity).toBe("error");
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("parses issues from bullet points in response", async () => {
      useFixture("error");
      process.env["OPENROUTER_API_KEY"] = "test-key";

      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      const result = await validator.validate();

      expect(result.issues).toContain("Missing required `owner` field in frontmatter");
      expect(result.issues).toContain("Missing Objective section");
      expect(result.issues).toContain("Missing Criteria section");
    });

    it("throws when apiKeyEnvVar is not provided", async () => {
      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
      });

      await expect(validator.validate()).rejects.toThrow("apiKeyEnvVar");
    });

    it("throws when model is not provided", async () => {
      process.env["MY_KEY"] = "test-key";

      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
        apiKeyEnvVar: "MY_KEY",
      });

      await expect(validator.validate()).rejects.toThrow("model");

      delete process.env["MY_KEY"];
    });

    it("uses custom apiKeyEnvVar", async () => {
      useFixture("compliant");
      process.env["CUSTOM_API_KEY"] = "test-key";

      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
        apiKeyEnvVar: "CUSTOM_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });

      const result = await validator.validate();
      expect(result.compliant).toBe(true);

      delete process.env["CUSTOM_API_KEY"];
    });
  });

  describe("custom specFilePattern", () => {
    it("finds spec file by exact custom name", () => {
      const dir = join(osTmpdir(), `praxis-spec-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SPEC.md"), "# Spec\nRequired fields: name");
      writeFileSync(join(dir, "doc.md"), "---\ntype: role\n---\n# Doc");

      const validator = new DocumentValidator({
        documentPath: join(dir, "doc.md"),
        specFilePattern: "SPEC.md",
        useCache: false,
      });

      expect(validator.readmePath).toBe(join(dir, "SPEC.md"));

      rmSync(dir, { recursive: true, force: true });
    });

    it("finds spec file by glob pattern", () => {
      const dir = join(osTmpdir(), `praxis-spec-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "README.roles.md"), "# Roles Spec");
      writeFileSync(join(dir, "doc.md"), "---\ntype: role\n---\n# Doc");

      const validator = new DocumentValidator({
        documentPath: join(dir, "doc.md"),
        specFilePattern: "README.*.md",
        useCache: false,
      });

      expect(validator.readmePath).toBe(join(dir, "README.roles.md"));

      rmSync(dir, { recursive: true, force: true });
    });

    it("throws when custom spec file not found", () => {
      const dir = join(osTmpdir(), `praxis-spec-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "doc.md"), "---\ntype: role\n---\n# Doc");

      expect(
        () =>
          new DocumentValidator({
            documentPath: join(dir, "doc.md"),
            specFilePattern: "SPEC.md",
            useCache: false,
          }),
      ).toThrow("No SPEC.md found");

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("content hash", () => {
    it("returns 8-character hex string", () => {
      const validator = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        useCache: false,
      });

      const hash = validator.getContentHash();

      expect(hash).toHaveLength(8);
      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe("caching", () => {
    it("uses cached result on second call with same content", async () => {
      useFixture("compliant");
      process.env["OPENROUTER_API_KEY"] = "test-key";

      const cacheManager = new CacheManager(join(tmpdir, ".praxis", "cache", "validation"));

      const validator1 = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        cacheManager,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      await validator1.validate();
      expect(validator1.cacheHit).toBe(false);

      const validator2 = new DocumentValidator({
        documentPath: join(tmpdir, "content", "roles", "test-role.md"),
        cacheManager,
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        model: "x-ai/grok-4.1-fast",
      });
      await validator2.validate();
      expect(validator2.cacheHit).toBe(true);
    });
  });
});
