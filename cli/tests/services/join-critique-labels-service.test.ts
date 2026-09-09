import type { LedgerCritiqueRecord } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("joinCritiqueLabelsService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-join-labels-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Appends one triage session file of raw records. */
  function seedTriageSession(name: string, records: object[]): void {
    const dir = join(root, ".praxis", "ledger", "triage");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.jsonl`),
      records.map((r) => JSON.stringify(r)).join("\n") + "\n",
    );
  }

  function critique(id: string, axiomId: string | null = null): LedgerCritiqueRecord {
    return {
      kind: "critique",
      id,
      run_id: "r1",
      timestamp: "2026-09-07T00:00:00.000Z",
      file_path: "docs/a.md",
      spec_path: "docs/README.md",
      target_content_hash: "aaaa1111",
      spec_content_hash: "bbbb2222",
      reviewer_name: "flash",
      reviewer_model: "m",
      reviewer_hash: "aaaa1111",
      severity: "error",
      text: "vague",
      mode: "judgment",
      axiom_id: axiomId,
      axiom_version: axiomId ? 1 : null,
      assigned_by: null,
      population: "unknown",
      authorship: "unknown",
      authorship_evidence: null,
      agent_involved: null,
      pre_review: null,
    };
  }

  it("an assignment record labels a born-unlabeled critique", () => {
    seedTriageSession("s1", [
      {
        kind: "assignment",
        critique_id: "r1:1",
        axiom_id: "AX-aaaa11",
        axiom_version: 2,
        assigned_by: { decision: "matcher", suggested_by: "curator-model" },
        timestamp: "2026-09-07T00:00:01.000Z",
      },
    ]);

    const joined = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1"), critique("r1:2")],
    });

    expect(joined[0]).toMatchObject({ axiom_id: "AX-aaaa11", axiom_version: 2 });
    expect(joined[1]).toMatchObject({ axiom_id: null });
  });

  it("a dismissal unlabels, and the newest record wins", () => {
    seedTriageSession("s1", [
      {
        kind: "assignment",
        critique_id: "r1:1",
        axiom_id: "AX-aaaa11",
        axiom_version: 1,
        assigned_by: { decision: "human", suggested_by: "curator-model" },
        timestamp: "2026-09-07T00:00:01.000Z",
      },
    ]);
    seedTriageSession("s2", [
      {
        kind: "dismissal",
        critique_id: "r1:1",
        reason: "noise",
        timestamp: "2026-09-07T00:00:02.000Z",
      },
    ]);

    const joined = joinCritiqueLabelsService(testConfig(root), { critiques: [critique("r1:1")] });

    expect(joined[0]).toMatchObject({ axiom_id: null, axiom_version: null });
  });

  it("a historical inline label stands unless a record supersedes it", () => {
    const joined = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1", "AX-historical")],
    });

    expect(joined[0]).toMatchObject({ axiom_id: "AX-historical" });
  });

  it("an assignment to a rejected proposal is void — the critique is unlabeled again", () => {
    seedTriageSession("s1", [
      {
        kind: "assignment",
        critique_id: "r1:1",
        axiom_id: "AX-cccc33",
        axiom_version: 1,
        assigned_by: { decision: "human", suggested_by: "curator-model" },
        timestamp: "2026-09-07T00:00:01.000Z",
      },
      {
        kind: "rejection",
        axiom_id: "AX-cccc33",
        reason: "not the axiom",
        timestamp: "2026-09-07T00:00:02.000Z",
      },
    ]);

    const joined = joinCritiqueLabelsService(testConfig(root), { critiques: [critique("r1:1")] });

    expect(joined[0]).toMatchObject({ axiom_id: null });
  });

  it("a dismissal stands over a later assignment until reinstated", () => {
    seedTriageSession("s1", [
      {
        kind: "dismissal",
        critique_id: "r1:1",
        reason: "the spec permits this",
        timestamp: "2026-09-07T00:00:01.000Z",
      },
      {
        kind: "assignment",
        critique_id: "r1:1",
        axiom_id: "AX-aaaa11",
        axiom_version: 1,
        assigned_by: { decision: "matcher", suggested_by: "curator-model" },
        timestamp: "2026-09-07T00:00:02.000Z",
      },
    ]);

    const [dismissed] = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1")],
    });

    seedTriageSession("s2", [
      {
        kind: "reinstatement",
        critique_id: "r1:1",
        reason: "misread",
        timestamp: "2026-09-07T00:00:03.000Z",
      },
    ]);

    const [reinstated] = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1")],
    });

    expect(dismissed).toMatchObject({ axiom_id: null });
    expect(reinstated).toMatchObject({ axiom_id: "AX-aaaa11" });
  });
});
