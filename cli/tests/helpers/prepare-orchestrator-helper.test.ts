import type { Command } from "commander";

import { afterEach, describe, expect, it, vi } from "vitest";

import { PraxisError } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { CommandContext } from "@/models/command-context.js";

/** The slice of a commander Command the handler reads. */
function fakeCommand(): Command {
  return {
    registeredArguments: [],
    opts: () => ({}),
    optsWithGlobals: () => ({}),
  } as unknown as Command;
}

const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

afterEach(() => {
  exitSpy.mockClear();
  errSpy.mockClear();
});

describe("prepareOrchestrator (Praxis binding)", () => {
  it("runs the orchestrator against a CommandContext", async () => {
    let seen: unknown;
    const handler = prepareOrchestrator((ctx) => {
      seen = ctx;

      return Promise.resolve("ok" as const);
    });

    await handler(fakeCommand());

    // The composition root's whole job: deciding what a Praxis command
    // runs against.
    expect(seen).toBeInstanceOf(CommandContext);
  });

  it("exits 2 for a usage mistake — the user can fix their command", async () => {
    const handler = prepareOrchestrator(() => {
      throw new PraxisError("MISSING_OPTION", "needs --reason");
    });

    await handler(fakeCommand());

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exits 1 for a failure that is not the user's spelling", async () => {
    const handler = prepareOrchestrator(() => {
      throw new PraxisError("REVIEWER_API_ERROR", "the backend fell over");
    });

    await handler(fakeCommand());

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 for an error praxis never classified at all", async () => {
    const handler = prepareOrchestrator(() => {
      throw new Error("unexpected");
    });

    await handler(fakeCommand());

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 on a failed outcome, which is a result rather than an error", async () => {
    const handler = prepareOrchestrator(() => Promise.resolve("failed" as const));

    await handler(fakeCommand());

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with nothing on success", async () => {
    const handler = prepareOrchestrator(() => Promise.resolve("ok" as const));

    await handler(fakeCommand());

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
