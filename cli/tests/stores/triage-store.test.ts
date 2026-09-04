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
