import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import resolveDiffService from "@/services/resolve-diff-service.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

/** Runs git quietly in the test repo. */
function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/**
 * A committed project whose docs/ is spec-governed and notes/ is not,
 * on a feature branch that touched both plus an ignored path.
 */
function diffProject(): { root: string; baseSha: string } {
  const { root, abs, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Docs spec",
      "docs/covered.md": "# Covered",
      "docs/doomed.md": "# Doomed",
      "notes/loose.md": "# No spec governs notes/",
      "generated/out.md": "# Generated",
    },
  });
  cleanups.push(cleanup);
  writeFileSync(
    abs(".praxis/config.json"),
    JSON.stringify({ sources: ["docs"], ignore: ["generated/**"] }),
  );

  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "T");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");
  const baseSha = git(root, "rev-parse", "HEAD");

  git(root, "checkout", "-qb", "feature");
  writeFileSync(abs("docs/covered.md"), "# Covered — edited\n");
  writeFileSync(abs("docs/added.md"), "# Added\n");
  writeFileSync(abs("notes/loose.md"), "# Edited but invisible\n");
  writeFileSync(abs("generated/out.md"), "# Regenerated\n");
  writeFileSync(abs("docs/README.md"), "# Docs spec — sharpened\n");
  git(root, "rm", "-q", "docs/doomed.md");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "feature work");

  return { root, baseSha };
}

describe("resolveDiffService", () => {
  it("splits the changed files into covered targets and invisible work", () => {
    const { root, baseSha } = diffProject();

    const diff = resolveDiffService(new PraxisConfig(root), {});

    expect(diff.baseRef).toBe("main");
    expect(diff.baseSha).toBe(baseSha);
    expect(diff.headSha).toBe(git(root, "rev-parse", "HEAD"));
    expect(diff.targets.map(({ relPath, status }) => ({ relPath, status }))).toEqual([
      { relPath: "docs/added.md", status: "added" },
      { relPath: "docs/covered.md", status: "modified" },
      { relPath: "docs/doomed.md", status: "deleted" },
    ]);
    // notes/ has no spec; generated/ is ignored; the spec file itself
    // and .praxis/ are provenance, never targets or coverage gaps.
    expect(diff.uncovered).toEqual(["notes/loose.md"]);
  });

  it("resolves the spec each target is governed by, deleted files included", () => {
    const { root } = diffProject();

    const diff = resolveDiffService(new PraxisConfig(root), {});
    const specs = new Set(diff.targets.map((target) => target.specPath));

    expect(specs).toEqual(new Set([join(root, "docs", "README.md")]));
  });

  it("takes an explicit base ref", () => {
    const { root, baseSha } = diffProject();

    const diff = resolveDiffService(new PraxisConfig(root), { base: "main" });

    expect(diff.baseSha).toBe(baseSha);
  });

  it("raises instructively when the base ref shares no history", () => {
    const { root } = diffProject();

    const resolve = () => resolveDiffService(new PraxisConfig(root), { base: "no-such-branch" });

    expect(resolve).toThrow(/no-such-branch/);
  });

  it("scopes to a praxis root nested inside the repository", () => {
    // The git repo owns the parent directory; the praxis project — like
    // a monorepo package — lives in a subdirectory. Git names paths
    // relative to the repo root; praxis must see them project-relative.
    const {
      root: repo,
      abs,
      cleanup,
    } = createValidatorTmpdir({
      sources: [],
      files: {
        "pkg/.praxis/config.json": JSON.stringify({ sources: ["docs"] }),
        "pkg/docs/README.md": "# Spec",
        "pkg/docs/covered.md": "# Covered",
        "outside.md": "# Changed outside the praxis root",
      },
    });
    cleanups.push(cleanup);
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.email", "t@example.com");
    git(repo, "config", "user.name", "T");
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "base");
    git(repo, "checkout", "-qb", "feature");
    writeFileSync(abs("pkg/docs/covered.md"), "# Covered — edited\n");
    writeFileSync(abs("outside.md"), "# Edited outside\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "feature");

    const diff = resolveDiffService(new PraxisConfig(join(repo, "pkg")), { base: "main" });

    expect(diff.targets.map((target) => target.relPath)).toEqual(["docs/covered.md"]);
    expect(diff.uncovered).toEqual([]);
  });

  it("raises instructively outside a git repository", () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: { "docs/README.md": "# Spec" },
    });
    cleanups.push(cleanup);

    const resolve = () => resolveDiffService(new PraxisConfig(root), {});

    expect(resolve).toThrow(/git repository/);
  });
});
