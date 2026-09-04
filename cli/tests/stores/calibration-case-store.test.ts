import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CalibrationCaseStore } from "@/stores/calibration-case-store.js";
import { expectationJson, seedCase } from "@tests/helpers/calibration-cases.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("CalibrationCaseStore", () => {
  let root: string;
  let store: CalibrationCaseStore;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-calibration-cases-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    store = new CalibrationCaseStore(testConfig(root));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns empty with no cases directory", () => {
    const swept = store.all();

    expect(swept.cases).toEqual([]);
    expect(swept.problems).toEqual([]);
  });

  it("reads every well-formed case, sorted by id", () => {
    seedCase(root, "case-b");
    seedCase(root, "case-a");

    const swept = store.all();
    const ids = swept.cases.map((currentCase) => currentCase.id);

    expect(ids).toEqual(["case-a", "case-b"]);
    expect(swept.problems).toEqual([]);
  });

  it("a malformed case is a problem, never a dead sweep", () => {
    seedCase(root, "case-good");
    const badDir = seedCase(root, "case-bad");
    writeFileSync(join(badDir, "expected.json"), "{ not json");

    const swept = store.all();

    expect(swept.cases.map((currentCase) => currentCase.id)).toEqual(["case-good"]);
    expect(swept.problems).toHaveLength(1);
    expect(swept.problems[0].message).toContain("case-bad");
  });

  it("read raises on a directory missing its pieces", () => {
    const caseDir = join(root, ".praxis", "calibration", "cases", "case-thin");
    mkdirSync(caseDir, { recursive: true });
    writeFileSync(join(caseDir, "expected.json"), expectationJson());

    expect(() => store.read("case-thin")).toThrow("spec.md");
  });

  it("read raises when the input file is ambiguous", () => {
    const caseDir = seedCase(root, "case-two-inputs");
    writeFileSync(join(caseDir, "second.ts"), "more code");

    expect(() => store.read("case-two-inputs")).toThrow("exactly one input file, found 2");
  });

  it("caseSetHash changes when a case is added or edited", () => {
    seedCase(root, "case-a");
    const before = store.caseSetHash();

    seedCase(root, "case-b");
    const withNewCase = store.caseSetHash();

    seedCase(root, "case-a", { inputContent: "edited code" });
    const withEditedCase = store.caseSetHash();

    expect(withNewCase).not.toBe(before);
    expect(withEditedCase).not.toBe(withNewCase);
  });
});
