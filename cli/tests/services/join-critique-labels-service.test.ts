import type { TriageRecord } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { TriageStore } from "@/stores/triage-store.js";
import { critiqueRecord } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";
import {
  assignmentRecord,
  dismissalRecord,
  reinstatementRecord,
  rejectionRecord,
} from "@tests/helpers/triage-records.js";

describe("joinCritiqueLabelsService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-join-labels-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Appends one triage session of records to the project's ledger. */
  function seedTriageSession(records: TriageRecord[]): void {
    new TriageStore(testConfig(root)).writeSession(records);
  }

  /** One unlabeled critique, or a historical inline-labeled one. */
  function critique(id: string, axiomId: string | null = null) {
    return critiqueRecord({
      id,
      axiom_id: axiomId,
      axiom_version: axiomId ? 1 : null,
      text: "vague",
    });
  }

  it("an assignment record labels a born-unlabeled critique", () => {
    seedTriageSession([
      assignmentRecord({
        axiom_version: 2,
        assigned_by: { decision: "matcher", suggested_by: "curator-model" },
      }),
    ]);

    const joined = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1"), critique("r1:2")],
    });

    expect(joined[0]).toMatchObject({ axiom_id: "AX-aaaa11", axiom_version: 2 });
    expect(joined[1]).toMatchObject({ axiom_id: null });
  });

  it("a dismissal unlabels, and the newest record wins", () => {
    seedTriageSession([assignmentRecord()]);
    seedTriageSession([dismissalRecord({ reason: "noise" })]);

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
    seedTriageSession([
      assignmentRecord({ axiom_id: "AX-cccc33" }),
      rejectionRecord({ axiom_id: "AX-cccc33", reason: "not the axiom" }),
    ]);

    const joined = joinCritiqueLabelsService(testConfig(root), { critiques: [critique("r1:1")] });

    expect(joined[0]).toMatchObject({ axiom_id: null });
  });

  it("a dismissal stands over a later assignment until reinstated", () => {
    seedTriageSession([
      dismissalRecord({ reason: "the spec permits this" }),
      assignmentRecord({ assigned_by: { decision: "matcher", suggested_by: "curator-model" } }),
    ]);

    const [dismissed] = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1")],
    });

    seedTriageSession([reinstatementRecord({ reason: "misread" })]);

    const [reinstated] = joinCritiqueLabelsService(testConfig(root), {
      critiques: [critique("r1:1")],
    });

    expect(dismissed).toMatchObject({ axiom_id: null });
    expect(reinstated).toMatchObject({ axiom_id: "AX-aaaa11" });
  });
});
