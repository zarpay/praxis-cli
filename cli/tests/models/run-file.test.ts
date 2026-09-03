import { describe, expect, it } from "vitest";

import { RunFile } from "@/models/run-file.js";
import { critiqueLine } from "@tests/helpers/ledger-runs.js";

const RUN_LINE = JSON.stringify({ kind: "run", run_id: "r1", reviewer_name: "flash" });

describe("RunFile", () => {
  it("parses the run record from line one and the critiques beneath", () => {
    const content = [RUN_LINE, critiqueLine({ runId: "r1", seq: 1 })].join("\n") + "\n";

    const file = RunFile.fromContent(content);

    expect(file?.run.run_id).toBe("r1");
    expect(file?.critiques().map((critique) => critique.id)).toEqual(["r1:1"]);
  });

  it("is not a run file when line one is anything else", () => {
    expect(RunFile.fromContent("not json\n")).toBeNull();
    expect(RunFile.fromContent(critiqueLine({ runId: "r1" }) + "\n")).toBeNull();
  });

  it("loses a malformed critique line, never the file", () => {
    const content = [RUN_LINE, "garbage {", critiqueLine({ runId: "r1", seq: 2 })].join("\n");

    const file = RunFile.fromContent(content);

    expect(file?.critiques()).toHaveLength(1);
  });

  it("serializes records to the write-once shape, one line each", () => {
    const serialized = RunFile.serialize([{ kind: "run", run_id: "r1" } as never]);

    expect(serialized).toBe(RUN_LINE.replace(',"reviewer_name":"flash"', "") + "\n");
  });
});
