import { http, HttpResponse } from "msw";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Reviewer } from "@/models/reviewer.js";
import runCalibrationService from "@/services/run-calibration-service.js";
import { CalibrationCaseStore } from "@/stores/calibration-case-store.js";
import { CalibrationStore } from "@/stores/calibration-store.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { calibrationRecord, expectationJson, seedCase } from "@tests/helpers/calibration-cases.js";
import {
  createOpenRouterServer,
  OPENROUTER_URL,
  TEST_REVIEWER,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { testConfig } from "@tests/helpers/test-config.js";

const server = createOpenRouterServer();

const AXIOM = "AX-b951db";
const SPEC_CONTENT = "# Services\n\nError messages name the fix.\n";

describe("runCalibrationService", () => {
  let root: string;

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    root = join(tmpdir(), `praxis-run-calibration-test-${randomUUID()}`);
    mkdirSync(join(root, ".praxis"), { recursive: true });
    mkdirSync(join(root, "src", "services"), { recursive: true });
    writeFileSync(join(root, "src", "services", "README.md"), SPEC_CONTENT);
    seedAxiom(root, AXIOM, { grounded_in: "src/services/README.md#behavior" });

    seedCase(root, "case-fail", {
      inputContent: 'return err("BAD");',
      specContent: SPEC_CONTENT,
      expectedJson: expectationJson({
        verdict: "fail",
        expected_violations: [{ axiom_id: AXIOM, must_flag: true }],
        forbidden_violations: [],
      }),
    });
    seedCase(root, "case-pass", {
      inputContent: 'return err("cart must contain at least one item");',
      specContent: SPEC_CONTENT,
      expectedJson: expectationJson({
        verdict: "pass",
        expected_violations: [],
        forbidden_violations: [{ axiom_id: AXIOM, must_not_flag: true }],
      }),
    });

    process.env["OPENROUTER_API_KEY"] = "test-key";
  });

  afterEach(() => {
    delete process.env["OPENROUTER_API_KEY"];
    rmSync(root, { recursive: true, force: true });
  });

  /** Answers per request: fail-with-axiom when the input carries BAD, else pass. */
  function useDiscerningReviewer(): void {
    server.use(
      http.post(OPENROUTER_URL, async ({ request }) => {
        const body = await request.text();
        const response = body.includes("BAD")
          ? validationToolCallResponse("validation_fail", {
              reason: "vague error",
              issues: [{ axiom: AXIOM, text: '"BAD" names neither problem nor fix' }],
            })
          : validationToolCallResponse("validation_pass", { reason: "specific and actionable" });

        return HttpResponse.json(response);
      }),
    );
  }

  /** Passes everything — the lenient instrument true negatives exist to catch. */
  function useLenientReviewer(): void {
    const response = validationToolCallResponse("validation_pass", { reason: "fine" });

    server.use(http.post(OPENROUTER_URL, () => HttpResponse.json(response)));
  }

  function runInput(overrides: { repeats?: number } = {}) {
    const cfg = testConfig(root);
    const { cases } = new CalibrationCaseStore(cfg).all();

    return {
      cfg,
      input: {
        reviewer: Reviewer.fromConfig(TEST_REVIEWER),
        cases,
        repeats: overrides.repeats ?? 1,
      },
    };
  }

  it("scores a discerning reviewer perfectly and writes the record", async () => {
    useDiscerningReviewer();
    const { cfg, input } = runInput();

    const result = await runCalibrationService(cfg, input);

    expect(result.record.verdict_matches).toBe(2);
    expect(result.record.unverified_count).toBe(0);
    expect(result.record.false_positive_count).toBe(0);
    expect(result.record.case_count).toBe(2);
    expect(result.record.axiom_scores).toEqual([
      {
        axiom_id: AXIOM,
        cases: 2,
        true_positives: 1,
        false_positives: 0,
        false_negatives: 0,
        variance: null,
      },
    ]);

    const stored = new CalibrationStore(cfg).records();
    expect(stored).toEqual([result.record]);
  });

  it("leniency costs agreement exactly as over-triggering does (06)", async () => {
    useLenientReviewer();
    const { cfg, input } = runInput();

    const result = await runCalibrationService(cfg, input);

    expect(result.record.verdict_matches).toBe(1);
    const score = result.record.axiom_scores[0];
    expect(score.false_negatives).toBe(1);
    expect(score.true_positives).toBe(0);
  });

  it("the case set hash on the record matches the store's", async () => {
    useDiscerningReviewer();
    const { cfg, input } = runInput();

    const result = await runCalibrationService(cfg, input);

    expect(result.record.case_set_hash).toBe(new CalibrationCaseStore(cfg).caseSetHash());
  });

  it("repeats multiply opportunities and report variance", async () => {
    useDiscerningReviewer();
    const { cfg, input } = runInput({ repeats: 2 });

    const result = await runCalibrationService(cfg, input);

    expect(result.record.repeats).toBe(2);
    expect(result.record.verdict_matches).toBe(4);
    const score = result.record.axiom_scores[0];
    expect(score.cases).toBe(4);
    expect(score.variance).toBe(0);
  });

  it("a failed review is an unverified mismatch, never dropped", async () => {
    server.use(http.post(OPENROUTER_URL, () => HttpResponse.json({}, { status: 500 })));
    const { cfg, input } = runInput();

    const result = await runCalibrationService(cfg, input);

    expect(result.record.unverified_count).toBe(2);
    expect(result.record.verdict_matches).toBe(0);
    const unverifiedOutcomes = result.outcomes.filter((outcome) => outcome.actual === null);
    expect(unverifiedOutcomes).toHaveLength(2);
  });

  it("flags drift against the previous record for the same reviewer name", async () => {
    const { cfg } = runInput();
    const store = new CalibrationStore(cfg);
    const perfect = calibrationRecord({
      calibration_id: "20260901T000000000Z-previous",
      reviewer_name: TEST_REVIEWER.name,
      reviewer_hash: "an-older-identity",
      axiom_scores: [
        {
          axiom_id: AXIOM,
          cases: 2,
          true_positives: 1,
          false_positives: 0,
          false_negatives: 0,
          variance: null,
        },
      ],
    });
    store.writeRecord(perfect);

    useLenientReviewer();
    const { input } = runInput();
    const result = await runCalibrationService(cfg, input);

    expect(result.record.drift_flagged).toEqual([AXIOM]);
  });

  it("streams one outcome per case × repeat", async () => {
    useDiscerningReviewer();
    const { cfg, input } = runInput({ repeats: 2 });
    const streamed: string[] = [];

    await runCalibrationService(cfg, {
      ...input,
      onProgress: (event) => streamed.push(`${event.outcome.caseId}#${event.outcome.repeat}`),
    });

    expect(streamed).toEqual(["case-fail#1", "case-pass#1", "case-fail#2", "case-pass#2"]);
  });
});
