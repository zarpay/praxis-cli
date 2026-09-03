import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SpecStore } from "@/stores/spec-store.js";

describe("SpecStore", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-spec-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe("governingPath", () => {
    it("finds the sibling spec by exact filename", () => {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "SPEC.md"), "# Spec");
      writeFileSync(join(root, "docs", "doc.md"), "# Doc");

      const store = new SpecStore({ root, specFilePattern: "SPEC.md" });

      expect(store.governingPath(join(root, "docs", "doc.md"))).toBe(join(root, "docs", "SPEC.md"));
    });

    it("finds the sibling spec by glob pattern", () => {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "README.roles.md"), "# Roles Spec");
      writeFileSync(join(root, "docs", "doc.md"), "# Doc");

      const store = new SpecStore({ root, specFilePattern: "README.*.md" });

      expect(store.governingPath(join(root, "docs", "doc.md"))).toBe(
        join(root, "docs", "README.roles.md"),
      );
    });

    it("throws the instructive error when no spec governs the directory", () => {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "doc.md"), "# Doc");

      const store = new SpecStore({ root, specFilePattern: "SPEC.md" });
      const locate = () => store.governingPath(join(root, "docs", "doc.md"));

      expect(locate).toThrow("No SPEC.md found");
    });
  });

  describe("read", () => {
    it("reads and validates one spec", () => {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(
        join(root, "docs", "README.md"),
        ["---", "paths:", '  - "docs/*.md"', "---", "# Spec"].join("\n"),
      );

      const spec = new SpecStore({ root }).read(join(root, "docs", "README.md"));

      expect(spec.paths).toEqual(["docs/*.md"]);
    });
  });

  describe("filesIn", () => {
    it("sweeps the source directories for spec files", () => {
      mkdirSync(join(root, "docs", "nested"), { recursive: true });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "docs", "README.md"), "# A");
      writeFileSync(join(root, "docs", "nested", "README.md"), "# B");
      writeFileSync(join(root, "src", "README.md"), "# C");
      writeFileSync(join(root, "src", "code.ts"), "export {};");

      const files = new SpecStore({ root }).filesIn(["docs", "src"]);

      expect(files).toHaveLength(3);
      expect(files.every((file) => file.endsWith("README.md"))).toBe(true);
    });

    it("sweeps nothing from a missing source", () => {
      expect(new SpecStore({ root }).filesIn(["nope"])).toEqual([]);
    });
  });
});
