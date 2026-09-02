import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { auditAxiomsOrchestrator } from "@/orchestrators/audit-axioms-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

beforeAll(() => {
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

const ACTIVE_AXIOM = [
  "---",
  "id: AX-aaaa11",
  "version: 1",
  "status: active",
  "severity: warning",
  "grounded_in: docs/README.md#error-messages",
  "introduced: 2026-09-03",
  "---",
  "",
  "Files have a frozen_string_literal comment.",
].join("\n");

describe("auditAxiomsOrchestrator", () => {
  it("flags an axiom the gate now refuses — a removal candidate (03)", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        ".praxis/axioms/AX-aaaa11.md": ACTIVE_AXIOM,
        "curator.js": curatorProviderModule({
          gate: {
            assessment: "not_appropriate",
            reasoning: "A regex decides it.",
            judgment_half: null,
          },
        }),
      },
      curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
    });
    cleanups.push(cleanup);
    const { logger, output } = createCaptureLogger();

    const outcome = await auditAxiomsOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("1 flagged");
  });

  it("requires a curator, with the instructive error", async () => {
    const { root, cleanup } = createValidatorTmpdir({ sources: ["docs"], files: {} });
    cleanups.push(cleanup);

    const auditWithoutCurator = auditAxiomsOrchestrator(testContext(root), {});

    await expect(auditWithoutCurator).rejects.toThrow(/"curator": \{/);
  });
});
