import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DocumentStore } from "@/stores/document-store.js";
import { testConfig } from "@tests/helpers/test-config.js";

/** A document declaring its `type:`. */
function typedContent(type: string): string {
  return ["---", `type: ${type}`, "---", "", "# Doc"].join("\n");
}

describe("DocumentStore", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-document-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes one file under the root, creating its directory. */
  function seed(relPath: string, content: string): void {
    const path = join(root, relPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }

  describe("files", () => {
    it("sweeps documents across sources, never specs or underscore templates", () => {
      seed("docs/guide.md", "# Guide");
      seed("docs/nested/deep.md", "# Deep");
      seed("docs/README.md", "# The spec");
      seed("docs/_template.md", "# Template");
      seed("reference/api.md", "# API");

      const paths = new DocumentStore(testConfig(root, { sources: ["docs", "reference"] })).files();

      expect(paths).toHaveLength(3);
      expect(paths.every((path) => !path.endsWith("README.md"))).toBe(true);
    });

    it("includes documents in directories with no spec at all", () => {
      seed("docs/uncovered/floating.md", "# No spec governs me");

      const paths = new DocumentStore(testConfig(root, { sources: ["docs"] })).files();

      expect(paths).toHaveLength(1);
    });

    it("honors absolute ignore patterns", () => {
      seed("docs/counted.md", "# Counted");
      seed("docs/generated/output.md", "# Generated");

      const store = new DocumentStore(
        testConfig(root, { sources: ["docs"], ignore: ["docs/generated/**"] }),
      );

      expect(store.files()).toHaveLength(1);
    });

    it("sweeps nothing from a missing source — unused taxonomy is normal", () => {
      expect(new DocumentStore(testConfig(root, { sources: ["nope"] })).files()).toEqual([]);
    });
  });

  describe("countsByType", () => {
    it("counts references and folds conventions and constitutions into context", () => {
      seed("reference/api.md", typedContent("reference"));
      seed("reference/schema.md", typedContent("reference"));
      seed("context/style.md", typedContent("convention"));
      seed("context/values.md", typedContent("constitution"));
      seed("context/untyped.md", "# No frontmatter");

      const counts = new DocumentStore(
        testConfig(root, { sources: ["reference", "context"] }),
      ).countsByType();

      expect(counts).toEqual({ references: 2, context: 2 });
    });
  });
});
