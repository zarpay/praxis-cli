import type { LedgerRecord, ReviewedTarget } from "@/types.js";

import { HttpResponse, http } from "msw";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import reviewNamedService from "@/services/review-named-service.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import {
  OPENROUTER_URL,
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  server.resetHandlers();
  while (cleanups.length) cleanups.pop()?.();
  delete process.env["MISSING_KEY_VAR"];
});

/** Every review in the test comes back with the given verdict. */
function useVerdict(
  tool: "validation_pass" | "validation_warn" | "validation_fail",
  args: { reason: string; issues?: (string | { axiom: string | null; text: string })[] } = {
    reason: "Because.",
    issues: ["An issue"],
  },
): void {
  useOpenRouterResponse(server, validationToolCallResponse(tool, args));
}

const KEYED = { name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" };

describe("reviewNamedService", () => {
  /** A project with one keyed reviewer and two documents to review. */
  function reviewingProject(): {
    root: string;
    config: PraxisConfig;
    abs: (rel: string) => string;
  } {
    const { root, abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: {
        "specs/README.md": "# Spec\n\nDocuments must have a title.",
        "specs/doc.md": "# Doc",
        "specs/other.md": "# Other",
      },
      reviewers: [KEYED],
    });
    cleanups.push(cleanup);

    return { root, config: new PraxisConfig(root), abs };
  }

  it("counts an error verdict for a named target", async () => {
    useVerdict("validation_fail");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamedService({
      targets: [abs("specs/doc.md")],
      root,
      config,
      useCache: false,
    });

    expect(result).toEqual({ errors: 1, warnings: 0 });
  });

  it("counts a warning separately from an error", async () => {
    useVerdict("validation_warn");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamedService({
      targets: [abs("specs/doc.md")],
      root,
      config,
      useCache: false,
    });

    expect(result).toEqual({ errors: 0, warnings: 1 });
  });

  it("reviews every named target, not just the first", async () => {
    useVerdict("validation_fail");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamedService({
      targets: [abs("specs/doc.md"), abs("specs/other.md")],
      root,
      config,
      useCache: false,
    });

    expect(result.errors).toBe(2);
  });

  it("counts nothing for a compliant target", async () => {
    useVerdict("validation_pass");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamedService({
      targets: [abs("specs/doc.md")],
      root,
      config,
      useCache: false,
    });

    expect(result).toEqual({ errors: 0, warnings: 0 });
  });

  it("takes the worst verdict when reviewers disagree about one target", async () => {
    server.use(
      http.post(OPENROUTER_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };

        return HttpResponse.json(
          body.model === "strict-model"
            ? validationToolCallResponse("validation_fail", { reason: "No.", issues: ["Bad"] })
            : validationToolCallResponse("validation_pass", { reason: "Fine." }),
        );
      }),
    );
    const { root, abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: { "specs/README.md": "# Spec", "specs/doc.md": "# Doc" },
      reviewers: [
        KEYED,
        { name: "strict", model: "strict-model", apiKeyEnvVar: KEYED.apiKeyEnvVar },
      ],
    });
    cleanups.push(cleanup);

    const result = await reviewNamedService({
      targets: [abs("specs/doc.md")],
      root,
      config: new PraxisConfig(root),
      useCache: false,
    });

    // One reviewer passed and one failed: the target is an error, not a pass.
    expect(result).toEqual({ errors: 1, warnings: 0 });
  });

  it("reports each target's findings as it lands", async () => {
    useVerdict("validation_fail", { reason: "no", issues: ["Bad thing"] });
    const { root, config, abs } = reviewingProject();
    const seen: { path: string; findingTexts: string[] }[] = [];

    await reviewNamedService({
      targets: [abs("specs/doc.md"), abs("specs/other.md")],
      root,
      config,
      useCache: false,
      onTarget: ({ path, findings }) =>
        seen.push({ path, findingTexts: findings.map((finding) => finding.text) }),
    });

    expect(seen).toHaveLength(2);
    expect(seen[0].findingTexts).toEqual(["Bad thing"]);
  });

  /** Parsed records of every run file, sorted by filename. */
  function ledgerRuns(root: string): LedgerRecord[][] {
    const dir = join(root, ".praxis", "ledger", "runs");

    if (!existsSync(dir)) return [];

    return readdirSync(dir)
      .sort()
      .map((file) =>
        readFileSync(join(dir, file), "utf8")
          .trimEnd()
          .split("\n")
          .map((line) => JSON.parse(line) as LedgerRecord),
      );
  }

  describe("the two channels (04)", () => {
    /** A reviewing project whose spec has one active axiom grounded in it. */
    function projectWithAxiom(reviewers = [KEYED]): {
      root: string;
      config: PraxisConfig;
      abs: (rel: string) => string;
    } {
      const axiom = axiomContent(
        { version: "2", severity: "warning", grounded_in: "specs/README.md#titles" },
        { statement: "Titles say what the document is about." },
      );

      const { root, abs, cleanup } = createValidatorTmpdir({
        sources: ["specs"],
        files: {
          "specs/README.md": "# Spec\n\nDocuments must have a title.",
          "specs/doc.md": "# Doc",
          ".praxis/axioms/AX-aaaa11.md": axiom,
        },
        reviewers,
      });
      cleanups.push(cleanup);

      return { root, config: new PraxisConfig(root), abs };
    }

    it("a cited checklist axiom lands matched: version resolved, provenance recorded", async () => {
      useVerdict("validation_fail", {
        reason: "no",
        issues: [{ axiom: "AX-aaaa11", text: "Title is vague." }],
      });
      const { root, config, abs } = projectWithAxiom();
      const targets: ReviewedTarget[] = [];

      await reviewNamedService({
        targets: [abs("specs/doc.md")],
        root,
        config,
        useCache: false,
        onTarget: (event) => targets.push(event),
      });

      const finding = targets[0].findings[0];
      const critiqueRecords = ledgerRuns(root)
        .flat()
        .filter((record) => record.kind === "critique");

      // The finding speaks in the axiom's ratified terms, not run-varying prose.
      expect(finding).toMatchObject({
        axiomId: "AX-aaaa11",
        text: "Titles say what the document is about.",
        severity: "warning",
      });
      expect(critiqueRecords[0]).toMatchObject({
        axiom_id: "AX-aaaa11",
        axiom_version: 2,
        assigned_by: "checklist",
      });
    });

    it("a hallucinated axiom id demotes to the open channel — never a ledger assignment", async () => {
      useVerdict("validation_fail", {
        reason: "no",
        issues: [{ axiom: "AX-ffffff", text: "Invented citation." }],
      });
      const { root, config, abs } = projectWithAxiom();
      const targets: ReviewedTarget[] = [];

      await reviewNamedService({
        targets: [abs("specs/doc.md")],
        root,
        config,
        useCache: false,
        onTarget: (event) => targets.push(event),
      });

      const finding = targets[0].findings[0];
      const critiqueRecords = ledgerRuns(root)
        .flat()
        .filter((record) => record.kind === "critique");

      expect(finding.axiomId).toBeNull();
      expect(finding.text).toBe("Invented citation.");
      expect(critiqueRecords[0]).toMatchObject({ axiom_id: null, assigned_by: null });
    });

    it("two reviewers citing one axiom collapse to one finding with two witnesses (06)", async () => {
      useVerdict("validation_fail", {
        reason: "no",
        issues: [{ axiom: "AX-aaaa11", text: "Title is vague." }],
      });
      const second = { name: "v32", model: "m2", apiKeyEnvVar: "OPENROUTER_API_KEY" };
      const { root, config, abs } = projectWithAxiom([KEYED, second]);
      const targets: ReviewedTarget[] = [];

      await reviewNamedService({
        targets: [abs("specs/doc.md")],
        root,
        config,
        useCache: false,
        onTarget: (event) => targets.push(event),
      });

      expect(targets[0].findings).toHaveLength(1);
      expect(targets[0].findings[0].witnesses).toEqual(["flash", "v32"]);
      expect(targets[0].reviewerCount).toBe(2);
    });
  });

  describe("the ledger", () => {
    it("persists each reviewer's pass with scope files — fast-loop runs are evidence", async () => {
      useVerdict("validation_fail");
      const { root, config, abs } = reviewingProject();

      await reviewNamedService({ targets: [abs("specs/doc.md")], root, config, useCache: false });

      const runs = ledgerRuns(root);

      expect(runs).toHaveLength(1);
      expect(runs[0][0]).toMatchObject({ kind: "run", scope: "files", trigger: "manual" });
      expect(runs[0].slice(1).every((record) => record.kind === "critique")).toBe(true);
      expect(runs[0].length).toBeGreaterThan(1);
    });

    it("writes nothing when ledger is false", async () => {
      useVerdict("validation_pass");
      const { root, config, abs } = reviewingProject();

      await reviewNamedService({
        targets: [abs("specs/doc.md")],
        root,
        config,
        useCache: false,
        ledger: false,
      });

      expect(ledgerRuns(root)).toEqual([]);
    });
  });
});
