import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TriageStore } from "@/stores/triage-store.js";
import { testConfig } from "@tests/helpers/test-config.js";
import {
  assignmentRecord,
  dismissalRecord,
  reinstatementRecord,
  rejectionRecord,
  unmatchedRecord,
} from "@tests/helpers/triage-records.js";

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
        dismissalRecord({ reason: "noise", timestamp: "t1" }),
        assignmentRecord({ timestamp: "t2" }),
      ]);

      const dismissed = store.decisions().get("r1:1");

      store.writeSession([reinstatementRecord({ reason: "misjudged", timestamp: "t3" })]);

      const reinstated = store.decisions().get("r1:1");

      expect(dismissed).toMatchObject({ dismissed: true });
      expect(dismissed?.assignment).toMatchObject({ axiom_id: "AX-aaaa11" });
      expect(reinstated).toMatchObject({ dismissed: false });
    });

    it("an assignment to a rejected proposal is void; the unmatched verdict stands", () => {
      store.writeSession([
        unmatchedRecord({ considered: ["AX-bbbb22@1"], timestamp: "t1" }),
        assignmentRecord({ axiom_id: "AX-cccc33", timestamp: "t2" }),
        rejectionRecord({ axiom_id: "AX-cccc33", reason: "not the axiom", timestamp: "t3" }),
      ]);

      const decision = store.decisions().get("r1:1");

      expect(decision?.assignment).toBeNull();
      expect(decision?.unmatched).toMatchObject({ considered: ["AX-bbbb22@1"] });
    });

    it("the newest assignment wins", () => {
      store.writeSession([
        assignmentRecord({ timestamp: "t1" }),
        assignmentRecord({ axiom_id: "AX-bbbb22", timestamp: "t2" }),
      ]);

      const decision = store.decisions().get("r1:1");

      expect(decision?.assignment).toMatchObject({ axiom_id: "AX-bbbb22" });
    });
  });

  describe("writeSession", () => {
    it("lands each session as its own file under ledger/triage", () => {
      const first = store.writeSession([dismissalRecord({ reason: "x" })]);
      const second = store.writeSession([dismissalRecord({ critique_id: "r1:2", reason: "y" })]);

      expect(first.path).toContain(join(".praxis", "ledger", "triage"));
      expect(second.path).not.toBe(first.path);
      expect(store.records()).toHaveLength(2);
    });
  });
});
