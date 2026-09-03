import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";

describe("resolveReportScopeService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-scope-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Seeds one run with controllable identity plus its critiques. */
  function seedRun(fields: {
    runId: string;
    branch?: string;
    sha?: string;
    at?: string;
    files?: string[];
  }): void {
    const critiques = (fields.files ?? []).map((file, index) =>
      critiqueLine({ runId: fields.runId, seq: index + 1, filePath: file }),
    );

    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: fields.runId,
      branch: fields.branch ?? null,
      commitSha: fields.sha ?? null,
      timestamp: fields.at ?? "2026-09-02T10:00:00.000Z",
      extraLines: critiques,
    });
  }

  it("returns the whole ledger unscoped", () => {
    seedRun({ runId: "r1", files: ["src/a.ts"] });
    seedRun({ runId: "r2", files: ["src/b.ts"] });

    const scoped = resolveReportScopeService({ root });

    expect(scoped.runs).toHaveLength(2);
    expect(scoped.critiques).toHaveLength(2);
  });

  it("scopes critiques by target glob without dropping runs", () => {
    seedRun({ runId: "r1", files: ["src/a.ts", "tests/a.test.ts"] });

    const scoped = resolveReportScopeService({ root, target: "src/**" });

    expect(scoped.critiques.map((critique) => critique.file_path)).toEqual(["src/a.ts"]);
  });

  it("scopes runs by branch, and critiques follow their runs", () => {
    seedRun({ runId: "r1", branch: "main", files: ["src/a.ts"] });
    seedRun({ runId: "r2", branch: "feature", files: ["src/b.ts"] });

    const scoped = resolveReportScopeService({ root, branch: "main" });

    expect(scoped.runs).toHaveLength(1);
    expect(scoped.critiques.map((critique) => critique.file_path)).toEqual(["src/a.ts"]);
  });

  it("scopes by since date", () => {
    seedRun({ runId: "r1", at: "2026-08-01T10:00:00.000Z" });
    seedRun({ runId: "r2", at: "2026-09-02T10:00:00.000Z" });

    const scoped = resolveReportScopeService({ root, since: "2026-09-01" });

    expect(scoped.runs.map((run) => run.run_id)).toEqual(["r2"]);
  });

  it("scopes by commit when the sha resolves in the clone", () => {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "T"], { cwd: root });
    writeFileSync(join(root, "doc.md"), "x");
    execFileSync("git", ["add", "-A"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "init"], { cwd: root });
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    seedRun({ runId: "r1", sha, files: ["src/a.ts"] });
    seedRun({ runId: "r2", files: ["src/b.ts"] });

    const scoped = resolveReportScopeService({ root, commit: sha });

    expect(scoped.runs.map((run) => run.run_id)).toEqual(["r1"]);
    expect(scoped.scope.unresolvableShas).toEqual([]);
  });

  it("collects an unresolvable sha with the facts its recorded run attests (12)", () => {
    const ghost = "f".repeat(40);
    seedRun({ runId: "r1", sha: ghost, branch: "feature", at: "2026-09-01T10:00:00.000Z" });

    const scoped = resolveReportScopeService({ root, commit: ghost });

    expect(scoped.scope.unresolvableShas).toEqual([
      { sha: ghost, branch: "feature", at: "2026-09-01T10:00:00.000Z" },
    ]);
    // The run still scopes in: its attestation is usable, only bytes are lost.
    expect(scoped.runs).toHaveLength(1);
  });
});
