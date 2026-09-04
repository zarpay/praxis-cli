import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CalibrationStore } from "@/stores/calibration-store.js";
import { calibrationRecord } from "@tests/helpers/calibration-cases.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("CalibrationStore", () => {
  let root: string;
  let store: CalibrationStore;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-calibration-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    store = new CalibrationStore(testConfig(root));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reads back what it wrote", () => {
    const record = calibrationRecord({ calibration_id: store.mintCalibrationId() });

    const written = store.writeRecord(record);
    const records = store.records();

    expect(written.path).toContain(".praxis/ledger/calibration/");
    expect(records).toEqual([record]);
  });

  it("returns empty with no partition", () => {
    expect(store.records()).toEqual([]);
  });

  it("reads never raise: an unparseable file is skipped", () => {
    const record = calibrationRecord({ calibration_id: store.mintCalibrationId() });
    store.writeRecord(record);

    const recordsDir = join(root, ".praxis", "ledger", "calibration");
    writeFileSync(join(recordsDir, "corrupt.json"), "{ not json");

    expect(store.records()).toEqual([record]);
  });

  it("latestFor returns the newest record for a reviewer identity only", () => {
    const older = calibrationRecord({
      calibration_id: "20260905T000000000Z-aaaaaaaa",
      reviewer_hash: "aaaa1111",
    });
    const newer = calibrationRecord({
      calibration_id: "20260905T000001000Z-aaaaaaaa",
      reviewer_hash: "aaaa1111",
      verdict_matches: 0,
    });
    const other = calibrationRecord({
      calibration_id: "20260905T000002000Z-aaaaaaaa",
      reviewer_hash: "bbbb2222",
    });

    store.writeRecord(older);
    store.writeRecord(newer);
    store.writeRecord(other);

    expect(store.latestFor("aaaa1111")).toEqual(newer);
    expect(store.latestFor("cccc3333")).toBeNull();
  });
});
