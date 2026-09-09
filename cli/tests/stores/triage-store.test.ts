import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TriageStore } from "@/stores/triage-store.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("TriageStore", () => {
  let root: string;
  let store: TriageStore;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-triage-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    store = new TriageStore(testConfig(root));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe("decisions", () => {
    it("a dismissal stands over any assignment until a reinstatement lifts it", () => {
      store.writeSession([
        { kind: "dismissal", critique_id: "r1:1", reason: "noise", timestamp: "t1" },
        {
          kind: "assignment",
          critique_id: "r1:1",
          axiom_id: "AX-aaaa11",
          axiom_version: 1,
          assigned_by: { decision: "matcher", suggested_by: "m" },
          timestamp: "t2",
        },
      ]);

      const dismissed = store.decisions().get("r1:1");

      store.writeSession([
        { kind: "reinstatement", critique_id: "r1:1", reason: "misjudged", timestamp: "t3" },
      ]);

      const reinstated = store.decisions().get("r1:1");

      expect(dismissed).toMatchObject({ dismissed: true });
      expect(dismissed?.assignment).toMatchObject({ axiom_id: "AX-aaaa11" });
      expect(reinstated).toMatchObject({ dismissed: false });
    });

    it("an assignment to a rejected proposal is void; the unmatched verdict stands", () => {
      store.writeSession([
        {
          kind: "unmatched",
          critique_id: "r1:1",
          considered: ["AX-bbbb22@1"],
          suggested_by: "m",
          timestamp: "t1",
        },
        {
          kind: "assignment",
          critique_id: "r1:1",
          axiom_id: "AX-cccc33",
          axiom_version: 1,
          assigned_by: { decision: "human", suggested_by: "m" },
          timestamp: "t2",
        },
        { kind: "rejection", axiom_id: "AX-cccc33", reason: "not the axiom", timestamp: "t3" },
      ]);

      const decision = store.decisions().get("r1:1");

      expect(decision?.assignment).toBeNull();
      expect(decision?.unmatched).toMatchObject({ considered: ["AX-bbbb22@1"] });
    });

    it("the newest assignment wins", () => {
      store.writeSession([
        {
          kind: "assignment",
          critique_id: "r1:1",
          axiom_id: "AX-aaaa11",
          axiom_version: 1,
          assigned_by: { decision: "matcher", suggested_by: "m" },
          timestamp: "t1",
        },
        {
          kind: "assignment",
          critique_id: "r1:1",
          axiom_id: "AX-bbbb22",
          axiom_version: 1,
          assigned_by: { decision: "human", suggested_by: "manual" },
          timestamp: "t2",
        },
      ]);

      const decision = store.decisions().get("r1:1");

      expect(decision?.assignment).toMatchObject({ axiom_id: "AX-bbbb22" });
    });
  });

  describe("writeSession", () => {
    it("lands each session as its own file under ledger/triage", () => {
      const first = store.writeSession([
        { kind: "dismissal", critique_id: "r1:1", reason: "x", timestamp: "t" },
      ]);
      const second = store.writeSession([
        { kind: "dismissal", critique_id: "r1:2", reason: "y", timestamp: "t" },
      ]);

      expect(first.path).toContain(join(".praxis", "ledger", "triage"));
      expect(second.path).not.toBe(first.path);
      expect(store.records()).toHaveLength(2);
    });
  });
});
