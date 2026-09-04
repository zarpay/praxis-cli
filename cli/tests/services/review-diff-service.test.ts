import type { LedgerCritiqueRecord, LedgerRunRecord } from "@/types.js";

import { HttpResponse, http } from "msw";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import resolveDiffService from "@/services/resolve-diff-service.js";
import reviewAllService from "@/services/review-all-service.js";
import reviewDiffService from "@/services/review-diff-service.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import {
  OPENROUTER_URL,
  TEST_REVIEWER,
  createOpenRouterServer,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  server.resetHandlers();
  while (cleanups.length) cleanups.pop()?.();
});

/** Runs git quietly in the test repo. */
function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

/**
 * A reviewer scripted by content marker: whatever version of a file is
 * in the prompt decides the verdict, so both sides of a diff get
 * deterministic, distinguishable readings. Counts every real call.
 */
function useMarkerReviewer(calls: { count: number }): void {
  server.use(
    http.post(OPENROUTER_URL, async ({ request }) => {
      calls.count++;
      const body = await request.text();

      if (body.includes("A-ONE")) {
        return HttpResponse.json(
          validationToolCallResponse("validation_fail", {
            reason: "violates the error-message standard",
            issues: [{ axiom: "AX-aaaa11", text: "Message names nothing." }],
          }),
        );
      }

      if (body.includes("A-TWO")) {
        return HttpResponse.json(
          validationToolCallResponse("validation_fail", {
            reason: "does two things now",
            issues: [{ axiom: "AX-bbbb22", text: "Second responsibility crept in." }],
          }),
        );
      }

      // B-ONE and B-TWO both violate AX-bbbb22 — the inherited case.
      return HttpResponse.json(
        validationToolCallResponse("validation_fail", {
          reason: "does two things",
          issues: [{ axiom: "AX-bbbb22", text: "Second responsibility." }],
        }),
      );
    }),
  );
}

/**
 * The flagship arrangement (12): a corpus-warmed base branch, then a
 * feature branch whose edits resolve one matched violation (a.md's
 * AX-aaaa11), introduce another (a.md's AX-bbbb22), and inherit one
 * (b.md's AX-bbbb22, present on both sides).
 */
async function diffProject(): Promise<{ root: string; cfg: PraxisConfig }> {
  const { root, abs, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Docs spec\nOne thing per file; messages name what was wrong.",
      "docs/a.md": "A-ONE\n",
      "docs/b.md": "B-ONE\n",
    },
  });
  cleanups.push(cleanup);
  seedAxiom(root, "AX-aaaa11", { grounded_in: "docs/README.md#messages" });
  seedAxiom(root, "AX-bbbb22", { grounded_in: "docs/README.md#one-thing" });

  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "Fixer Author");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");

  const cfg = new PraxisConfig(root);

  // Warm the base branch the way a corpus run would have (01: the
  // before side's verdict is usually already in the cache).
  await reviewAllService(cfg, { reviewers: [TEST_REVIEWER], ledger: false });

  git(root, "checkout", "-qb", "feature");
  writeFileSync(abs("docs/a.md"), "A-TWO\n");
  writeFileSync(abs("docs/b.md"), "B-TWO\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "feature work");

  return { root, cfg };
}

/** Every run file's records, oldest first. */
function ledgerRuns(root: string): { run: LedgerRunRecord; critiques: LedgerCritiqueRecord[] }[] {
  const dir = join(root, ".praxis", "ledger", "runs");

  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .sort()
    .map((file) => {
      const lines = readFileSync(join(dir, file), "utf8").trimEnd().split("\n");
      const [run, ...critiques] = lines.map(
        (line) => JSON.parse(line) as LedgerRunRecord & LedgerCritiqueRecord,
      );

      return { run, critiques };
    });
}

describe("reviewDiffService", () => {
  it("labels the branch's flow and costs ~one call per changed file", async () => {
    const calls = { count: 0 };
    useMarkerReviewer(calls);
    const { cfg } = await diffProject();
    const warmCalls = calls.count;

    const diff = resolveDiffService(cfg, {});
    const result = await reviewDiffService(cfg, { reviewers: [TEST_REVIEWER], diff });

    // Before sides are cache hits from the base warm; only the two
    // after sides cost anything (01's cost structure).
    expect(calls.count - warmCalls).toBe(2);
    expect(result.cacheStats).toEqual({ hits: 2, misses: 2 });

    expect(result.summary).toEqual({
      introduced: 1,
      resolved: 1,
      inherited: 1,
      errorsIntroduced: 1,
      unverified: 0,
    });

    const aFindings = result.perTarget.find((outcome) => outcome.relPath === "docs/a.md");

    expect(aFindings?.findings.map((finding) => finding.flow)).toEqual(["introduced"]);
    expect(aFindings?.resolved.map((critique) => critique.axiomId)).toEqual(["AX-aaaa11"]);
  });

  it("persists the diff run: facts, flow labels, and the resolved event with credit", async () => {
    const calls = { count: 0 };
    useMarkerReviewer(calls);
    const { root, cfg } = await diffProject();

    const diff = resolveDiffService(cfg, {});
    await reviewDiffService(cfg, { reviewers: [TEST_REVIEWER], diff });

    const diffRun = ledgerRuns(root).find(({ run }) => run.scope === "diff");

    expect(diffRun).toBeDefined();
    expect(diffRun!.run.diff).toMatchObject({
      base_ref: "main",
      base_sha: diff.baseSha,
      head_sha: diff.headSha,
      changed_files: 2,
      covered: 2,
      uncovered_count: 0,
      resolved_count: 1,
    });
    // After-side critiques only; the resolved event never inflates stock.
    expect(diffRun!.run.critique_count).toBe(2);

    const byFlow = (flow: string) =>
      diffRun!.critiques.filter((critique) => critique.flow === flow);

    expect(byFlow("introduced").map((c) => [c.file_path, c.axiom_id])).toEqual([
      ["docs/a.md", "AX-bbbb22"],
    ]);
    expect(byFlow("inherited").map((c) => [c.file_path, c.axiom_id])).toEqual([
      ["docs/b.md", "AX-bbbb22"],
    ]);

    const [resolved] = byFlow("resolved");

    expect(resolved).toMatchObject({
      file_path: "docs/a.md",
      axiom_id: "AX-aaaa11",
      resolved_by: "Fixer Author",
      before_run_id: null,
    });

    // Before sides were cache hits, so no run supplied them (12).
    for (const critique of [...byFlow("introduced"), ...byFlow("inherited")]) {
      expect(critique.before_run_id).toBeNull();
    }
  });

  it("reruns are idempotent snapshots: fresh run file, identical labels", async () => {
    const calls = { count: 0 };
    useMarkerReviewer(calls);
    const { root, cfg } = await diffProject();

    const diff = resolveDiffService(cfg, {});
    await reviewDiffService(cfg, { reviewers: [TEST_REVIEWER], diff });
    const callsAfterFirst = calls.count;

    const rerun = await reviewDiffService(cfg, { reviewers: [TEST_REVIEWER], diff });

    // The cache holds current (HEAD) state, so the after sides hit; the
    // before sides re-pay — a replay costs at most one call per file.
    expect(calls.count - callsAfterFirst).toBe(2);
    expect(rerun.cacheStats).toEqual({ hits: 2, misses: 2 });
    expect(rerun.summary).toMatchObject({ introduced: 1, resolved: 1, inherited: 1 });

    const diffRuns = ledgerRuns(root).filter(({ run }) => run.scope === "diff");

    expect(diffRuns).toHaveLength(2);
  });

  it("writes nothing when ledger is false, and a read-only cache stays untouched", async () => {
    const calls = { count: 0 };
    useMarkerReviewer(calls);
    const { root, cfg } = await diffProject();
    const cacheBytes = () =>
      readdirSync(join(root, ".praxis", "cache", "validation", "docs"))
        .sort()
        .map((file) =>
          readFileSync(join(root, ".praxis", "cache", "validation", "docs", file), "utf8"),
        )
        .join("\n");

    const before = cacheBytes();
    const diff = resolveDiffService(cfg, {});
    const result = await reviewDiffService(cfg, {
      reviewers: [TEST_REVIEWER],
      diff,
      ledger: false,
      readOnlyCache: true,
    });

    // Verdicts still verified — after sides re-derived — but no trace:
    // no diff run file, and the committed cache byte-identical.
    expect(result.summary.introduced).toBe(1);
    expect(ledgerRuns(root).filter(({ run }) => run.scope === "diff")).toHaveLength(0);
    expect(cacheBytes()).toBe(before);
  });
});
