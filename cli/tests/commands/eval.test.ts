import type { Verdict } from "@/domains/eval/types.js";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EvalCommand, severityRank } from "@/commands/eval.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import {
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

/** Every judgment in the test comes back with the given verdict. */
function useVerdict(tool: "validation_pass" | "validation_warn" | "validation_fail"): void {
  useOpenRouterResponse(
    server,
    validationToolCallResponse(tool, { reason: "Because.", issues: ["An issue"] }),
  );
}

/** A verdict with only the fields ranking depends on. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

/** An EvalCommand over a throwaway project with the given judges. */
function command(judges: { name: string; model: string; apiKeyEnvVar: string }[]): EvalCommand {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["specs"],
    files: { "specs/README.md": "# Spec", "specs/doc.md": "# Doc" },
    judges,
  });
  cleanups.push(cleanup);

  return new EvalCommand({ root, config: new PraxisConfig(root) });
}

const KEYED = { name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" };

describe("severityRank", () => {
  it("ranks a compliant verdict lowest", () => {
    expect(severityRank(verdict({ compliant: true }))).toBe(0);
  });

  it("ranks a warning above a pass", () => {
    const pass = severityRank(verdict({ compliant: true }));
    const warn = severityRank(verdict({ compliant: false, severity: "warning" }));

    expect(warn).toBeGreaterThan(pass);
  });

  it("ranks an error above a warning", () => {
    const warn = severityRank(verdict({ compliant: false, severity: "warning" }));
    const error = severityRank(verdict({ compliant: false, severity: "error" }));

    expect(error).toBeGreaterThan(warn);
  });

  it("ignores severity on a compliant verdict", () => {
    const rank = severityRank(verdict({ compliant: true, severity: "error" }));

    expect(rank).toBe(0);
  });
});

describe("judge configuration", () => {
  it("raises when the project configures no judges", async () => {
    const run = command([]).all({ verbose: false, failFast: false, cache: false });

    await expect(run).rejects.toThrow(/judge/i);
  });

  it("raises when --judge names a judge that is not configured", async () => {
    const run = command([KEYED]).all({
      verbose: false,
      failFast: false,
      cache: false,
      judge: "nope",
    });

    await expect(run).rejects.toThrow(/nope/);
  });

  it("names the configured judges when --judge does not match", async () => {
    const run = command([KEYED]).all({
      verbose: false,
      failFast: false,
      cache: false,
      judge: "nope",
    });

    await expect(run).rejects.toThrow(/flash/);
  });

  it("raises when a judge's API key variable is unset", async () => {
    const keyless = { name: "keyless", model: "m", apiKeyEnvVar: "MISSING_KEY_VAR" };
    const run = command([keyless]).all({ verbose: false, failFast: false, cache: false });

    await expect(run).rejects.toThrow(/MISSING_KEY_VAR/);
  });

  it("raises when a judge's API key variable is set but empty", async () => {
    process.env["MISSING_KEY_VAR"] = "";
    const keyless = { name: "keyless", model: "m", apiKeyEnvVar: "MISSING_KEY_VAR" };
    const run = command([keyless]).all({ verbose: false, failFast: false, cache: false });

    await expect(run).rejects.toThrow(/MISSING_KEY_VAR/);
  });
});

describe("run() target dispatch", () => {
  const BASE = { verbose: false, failFast: false, cache: false };

  /** A project with one keyed judge and two documents to evaluate. */
  function judgingProject(): { command: EvalCommand; abs: (rel: string) => string } {
    const { root, abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: {
        "specs/README.md": "# Spec\n\nDocuments must have a title.",
        "specs/doc.md": "# Doc",
        "specs/other.md": "# Other",
      },
      judges: [KEYED],
    });
    cleanups.push(cleanup);

    return { command: new EvalCommand({ root, config: new PraxisConfig(root) }), abs };
  }

  it("delegates to the full run when given no targets", async () => {
    useVerdict("validation_pass");
    const { command } = judgingProject();
    const summary = await command.run([], BASE);

    // Only all() returns a full EvalSummary; the targeted path returns
    // just the error/warning tally, so `total` is what tells them apart.
    expect(summary).toHaveProperty("total");
  });

  it("returns only the tally when given targets", async () => {
    useVerdict("validation_pass");
    const { command, abs } = judgingProject();
    const summary = await command.run([abs("specs/doc.md")], BASE);

    expect(summary).not.toHaveProperty("total");
  });

  it("counts an error verdict for a named target", async () => {
    useVerdict("validation_fail");
    const { command, abs } = judgingProject();
    const summary = await command.run([abs("specs/doc.md")], BASE);

    expect(summary).toEqual({ errors: 1, warnings: 0 });
  });

  it("counts a warning separately from an error", async () => {
    useVerdict("validation_warn");
    const { command, abs } = judgingProject();
    const summary = await command.run([abs("specs/doc.md")], BASE);

    expect(summary).toEqual({ errors: 0, warnings: 1 });
  });

  it("evaluates every named target, not just the first", async () => {
    useVerdict("validation_fail");
    const { command, abs } = judgingProject();
    const summary = await command.run([abs("specs/doc.md"), abs("specs/other.md")], BASE);

    expect(summary.errors).toBe(2);
  });

  it("counts nothing for a compliant target", async () => {
    useVerdict("validation_pass");
    const { command, abs } = judgingProject();
    const summary = await command.run([abs("specs/doc.md")], BASE);

    expect(summary).toEqual({ errors: 0, warnings: 0 });
  });
});
