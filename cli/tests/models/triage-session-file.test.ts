import type { TriageRecord } from "@/types.js";

import { describe, expect, it } from "vitest";

import { TriageSessionFile } from "@/models/triage-session-file.js";
import { dismissalRecord } from "@tests/helpers/triage-records.js";

const DISMISSAL: TriageRecord = dismissalRecord({
  reason: "off-spec",
  timestamp: "2026-09-04T10:00:00.000Z",
});

describe("TriageSessionFile", () => {
  it("round-trips records through serialize and fromContent", () => {
    const content = TriageSessionFile.serialize([DISMISSAL]);

    const records = TriageSessionFile.fromContent(content).records();

    expect(records).toEqual([DISMISSAL]);
  });

  it("loses a malformed line, never the queue", () => {
    const content = TriageSessionFile.serialize([DISMISSAL]) + "garbage {\n";

    const records = TriageSessionFile.fromContent(content).records();

    expect(records).toHaveLength(1);
  });
});
