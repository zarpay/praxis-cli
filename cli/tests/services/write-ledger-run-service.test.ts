import type { LedgerCritiqueRecord, LedgerEntry, LedgerRunRecord } from "@/types.js";

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import writeLedgerRunService from "@/services/write-ledger-run-service.js";

const REVIEWER = { name: "flash", model: "some/model", hash: "abcd1234" };

describe("writeLedgerRunService", () => {
  let root: string;

  beforeEach(() => {
    // Deliberately not a git repo: commit_sha/branch nulls fall out naturally.
    root = join(tmpdir(), `praxis-ledger-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** One reviewed entry, overridable per test. */
  function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
    return {
      verdict: { path: join(root, "docs", "guide.md"), compliant: true, issues: [] },
      cacheHit: false,
      evidence: {
        usage: { promptTokens: 100, completionTokens: 20, costUsd: 0.001 },
        specPath: join(root, "docs", "README.md"),
        targetContentHash: "aaaa1111",
        specContentHash: "bbbb2222",
      },
      ...overrides,
    };
  }

  /** Writes a run and reads the records back. */
  function writeAndRead(
    entries: LedgerEntry[],
    scope: "corpus" | "files" = "corpus",
  ): { runId: string; path: string; run: LedgerRunRecord; critiques: LedgerCritiqueRecord[] } {
    const { runId, path } = writeLedgerRunService({
      root,
      reviewer: REVIEWER,
      trigger: "manual",
      scope,
      entries,
    });
    const lines = readFileSync(path, "utf8").trimEnd().split("\n");
    const records = lines.map((line) => JSON.parse(line) as LedgerRunRecord | LedgerCritiqueRecord);

    return {
      runId,
      path,
      run: records[0] as LedgerRunRecord,
      critiques: records.slice(1) as LedgerCritiqueRecord[],
    };
  }

  it("lands one file per run under .praxis/ledger/runs, named by a sortable run id", () => {
    const { runId, path } = writeAndRead([entry()]);

    expect(path).toBe(join(root, ".praxis", "ledger", "runs", `${runId}.jsonl`));
    expect(runId).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{8}$/);
  });

  it("issues distinct run ids across calls", () => {
    const first = writeAndRead([entry()]);
    const second = writeAndRead([entry()]);

    expect(second.runId).not.toBe(first.runId);
  });

  it("writes the run record first, carrying the reviewer's full identity", () => {
    const { run } = writeAndRead([entry()]);

    expect(run).toMatchObject({
      kind: "run",
      trigger: "manual",
      scope: "corpus",
      files_evaluated: 1,
      reviewer_name: "flash",
      reviewer_model: "some/model",
      reviewer_hash: "abcd1234",
      calibration_status_at_run: "uncalibrated",
      baseline: true,
    });
    expect(run.timestamp).toBeTruthy();
  });

  describe("the baseline flag (02)", () => {
    it("marks the first corpus run under a hash as the epoch-opening baseline", () => {
      const first = writeAndRead([entry()], "corpus");
      const second = writeAndRead([entry()], "corpus");

      expect(first.run.baseline).toBe(true);
      expect(second.run.baseline).toBe(false);
    });

    it("never claims baseline for a files-scope fast loop", () => {
      const filesRun = writeAndRead([entry()], "files");

      expect(filesRun.run.baseline).toBe(false);
    });

    it("re-baselines when a new hash opens its epoch after history", () => {
      writeAndRead([entry()], "corpus");

      const { runId, path } = writeLedgerRunService({
        root,
        reviewer: { ...REVIEWER, hash: "ffff9999" },
        trigger: "manual",
        scope: "corpus",
        entries: [entry()],
      });
      const firstLine = readFileSync(path, "utf8").split("\n", 1)[0];
      const newEpochRun = JSON.parse(firstLine) as LedgerRunRecord;

      expect(runId).toBeTruthy();
      expect(newEpochRun.baseline).toBe(true);
    });

    it("lets the first full run claim the baseline a files run before it could not", () => {
      const filesRun = writeAndRead([entry()], "files");
      const corpusRun = writeAndRead([entry()], "corpus");

      expect(filesRun.run.baseline).toBe(false);
      expect(corpusRun.run.baseline).toBe(true);
    });
  });

  it("records null git facts outside a repository, never guessing", () => {
    const { run } = writeAndRead([entry()]);

    expect(run.commit_sha).toBeNull();
    expect(run.branch).toBeNull();
  });

  it("fans a verdict's issues out into one critique record each, ids in write order", () => {
    const failing = entry({
      verdict: {
        path: join(root, "docs", "guide.md"),
        compliant: false,
        severity: "error",
        issues: ["Missing title", "No overview section"],
      },
    });

    const { runId, run, critiques } = writeAndRead([failing]);

    expect(run.critique_count).toBe(2);
    expect(critiques.map((c) => c.id)).toEqual([`${runId}:1`, `${runId}:2`]);
    expect(critiques.map((c) => c.text)).toEqual(["Missing title", "No overview section"]);
    expect(critiques[0]).toMatchObject({
      kind: "critique",
      run_id: runId,
      severity: "error",
      mode: "judgment",
      axiom_id: null,
      population: "unknown",
      authorship: "unknown",
      flow: null,
    });
  });

  it("stores paths project-relative and the provenance hashes verbatim", () => {
    const failing = entry({
      verdict: {
        path: join(root, "docs", "guide.md"),
        compliant: false,
        severity: "warning",
        issues: ["Thin"],
      },
    });

    const [critique] = writeAndRead([failing]).critiques;

    expect(critique.file_path).toBe("docs/guide.md");
    expect(critique.spec_path).toBe("docs/README.md");
    expect(critique.target_content_hash).toBe("aaaa1111");
    expect(critique.spec_content_hash).toBe("bbbb2222");
  });

  it("counts a cache-hit failure on the run record but writes no critiques for it", () => {
    const cachedFail = entry({
      cacheHit: true,
      verdict: {
        path: join(root, "docs", "guide.md"),
        compliant: false,
        severity: "error",
        issues: ["Old finding"],
      },
      evidence: {
        usage: null,
        specPath: join(root, "docs", "README.md"),
        targetContentHash: "aaaa1111",
        specContentHash: "bbbb2222",
      },
    });

    const { run, critiques } = writeAndRead([cachedFail]);

    expect(run.cache_hits).toBe(1);
    expect(run.cache_misses).toBe(0);
    expect(run.fail_count).toBe(1);
    expect(run.critique_count).toBe(0);
    expect(critiques).toEqual([]);
  });

  it("counts an unverified unit separately and writes no critiques for it", () => {
    const unverified = entry({
      verdict: {
        path: join(root, "docs", "gone.md"),
        compliant: false,
        unverified: true,
        issues: [],
      },
      evidence: null,
    });

    const { run, critiques } = writeAndRead([entry(), unverified]);

    expect(run.files_evaluated).toBe(2);
    expect(run.pass_count).toBe(1);
    expect(run.fail_count).toBe(0);
    expect(run.unverified_count).toBe(1);
    expect(critiques).toEqual([]);
  });

  it("sums usage per field, leaving a field null when nothing reported it", () => {
    const second = entry({
      evidence: {
        usage: { promptTokens: 50, completionTokens: null, costUsd: null },
        specPath: join(root, "docs", "README.md"),
        targetContentHash: "cccc3333",
        specContentHash: "bbbb2222",
      },
    });

    const { run } = writeAndRead([entry(), second]);

    expect(run.prompt_tokens).toBe(150);
    expect(run.completion_tokens).toBe(20);
    expect(run.cost_usd).toBe(0.001);
  });

  it("reports all-null usage as null, not zero — a disabled meter is not a free run", () => {
    const uncounted = entry({
      evidence: {
        usage: null,
        specPath: join(root, "docs", "README.md"),
        targetContentHash: "aaaa1111",
        specContentHash: "bbbb2222",
      },
    });

    const { run } = writeAndRead([uncounted]);

    expect(run.prompt_tokens).toBeNull();
    expect(run.completion_tokens).toBeNull();
    expect(run.cost_usd).toBeNull();
  });

  describe("git facts, against a real repository", () => {
    /** Turns the tmpdir into a committed git repo on branch main. */
    function gitInit(): void {
      for (const args of [
        ["init", "-q", "-b", "main"],
        ["config", "user.email", "test@praxis.dev"],
        ["config", "user.name", "Praxis Test"],
        ["add", "-A"],
        ["commit", "-q", "--allow-empty", "-m", "seed"],
      ]) {
        execFileSync("git", args, { cwd: root });
      }
    }

    it("records the sha and branch when the tree provably equals HEAD", () => {
      gitInit();

      const { run } = writeAndRead([entry()]);

      expect(run.branch).toBe("main");
      expect(run.commit_sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it("keeps the sha when only .praxis/ is dirty — its own writes are not content", () => {
      gitInit();
      mkdirSync(join(root, ".praxis", "cache"), { recursive: true });
      writeFileSync(join(root, ".praxis", "cache", "fresh.json"), "{}");

      const { run } = writeAndRead([entry()]);

      expect(run.commit_sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it("records a null sha for a dirty tree — the run reviewed uncommitted state", () => {
      gitInit();
      writeFileSync(join(root, "dirty.md"), "# uncommitted");

      const { run } = writeAndRead([entry()]);

      expect(run.commit_sha).toBeNull();
      expect(run.branch).toBe("main");
    });

    it("records nothing on a detached HEAD — there is no branch to name", () => {
      gitInit();
      execFileSync("git", ["checkout", "-q", "--detach"], { cwd: root });

      const { run } = writeAndRead([entry()]);

      expect(run.branch).toBeNull();
      expect(run.commit_sha).toBeNull();
    });
  });

  it("strips control characters from critique text", () => {
    const noisy = entry({
      verdict: {
        path: join(root, "docs", "guide.md"),
        compliant: false,
        severity: "error",
        issues: ["bad \u0000 byte \u0007 here"],
      },
    });

    const [critique] = writeAndRead([noisy]).critiques;

    expect(critique.text).toBe("bad  byte  here");
  });
});
