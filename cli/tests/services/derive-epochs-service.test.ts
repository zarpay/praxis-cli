import type { LedgerRunRecord } from "@/types.js";

import { describe, expect, it } from "vitest";

import deriveEpochsService from "@/services/derive-epochs-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

/** A minimal run record; tests vary the epoch-relevant fields. */
function run(fields: {
  name: string;
  hash: string;
  model?: string;
  at: string;
  baseline?: boolean;
}): LedgerRunRecord {
  return {
    kind: "run",
    run_id: `${fields.name}-${fields.at}`,
    timestamp: fields.at,
    reviewer_name: fields.name,
    reviewer_model: fields.model ?? "some/model",
    reviewer_hash: fields.hash,
    scope: "corpus",
    baseline: fields.baseline ?? false,
  } as LedgerRunRecord;
}

describe("deriveEpochsService", () => {
  it("derives one epoch per stable hash, per reviewer", () => {
    const series = deriveEpochsService(testConfig("/project"), {
      runs: [
        run({ name: "flash", hash: "aaaa", at: "2026-09-01T10:00:00Z", baseline: true }),
        run({ name: "flash", hash: "aaaa", at: "2026-09-02T10:00:00Z" }),
        run({ name: "v32", hash: "cccc", at: "2026-09-01T11:00:00Z" }),
      ],
    });

    const flash = series.find((entry) => entry.reviewerName === "flash");

    expect(series).toHaveLength(2);
    expect(flash!.epochs).toHaveLength(1);
    expect(flash!.epochs[0].runs).toHaveLength(2);
    expect(flash!.epochs[0].baseline?.baseline).toBe(true);
  });

  it("opens a new epoch at a hash change, naming a model swap", () => {
    const series = deriveEpochsService(testConfig("/project"), {
      runs: [
        run({ name: "flash", hash: "aaaa", model: "old/model", at: "2026-09-01T10:00:00Z" }),
        run({ name: "flash", hash: "bbbb", model: "new/model", at: "2026-09-02T10:00:00Z" }),
      ],
    });

    const epochs = series[0].epochs;

    expect(epochs).toHaveLength(2);
    expect(epochs[0].openedBy).toBeNull();
    expect(epochs[1].openedBy).toMatchObject({ label: "model → new/model" });
  });

  it("names a same-model change as config or prompt surface", () => {
    const series = deriveEpochsService(testConfig("/project"), {
      runs: [
        run({ name: "flash", hash: "aaaa", at: "2026-09-01T10:00:00Z" }),
        run({ name: "flash", hash: "bbbb", at: "2026-09-02T10:00:00Z" }),
      ],
    });

    expect(series[0].epochs[1].openedBy).toMatchObject({
      label: "config or prompt surface changed",
    });
  });

  it("keeps interleaved known hashes as two epochs, not four — set-wise (02)", () => {
    const series = deriveEpochsService(testConfig("/project"), {
      runs: [
        run({ name: "flash", hash: "aaaa", at: "2026-09-01T10:00:00Z" }),
        run({ name: "flash", hash: "bbbb", at: "2026-09-02T10:00:00Z" }),
        run({ name: "flash", hash: "aaaa", at: "2026-09-03T10:00:00Z" }),
        run({ name: "flash", hash: "bbbb", at: "2026-09-04T10:00:00Z" }),
      ],
    });

    const epochs = series[0].epochs;

    expect(epochs).toHaveLength(2);
    expect(epochs[0].runs).toHaveLength(2);
    expect(epochs[1].runs).toHaveLength(2);
  });
});
