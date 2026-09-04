import type { Command } from "commander";

import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareOrchestrator } from "@framework/prepare-orchestrator.js";
import { Logger } from "@framework/views/logger.js";

/** A quiet logger that collects what would have hit stderr. */
function captureLogger(): { logger: Logger; output: () => string } {
  let captured = "";
  const logger = new Logger({
    color: false,
    output: new Writable({
      write(chunk, _enc, cb) {
        captured += String(chunk);
        cb();
      },
    }),
  });

  return { logger, output: () => captured };
}

/** The slice of a commander Command the handler actually reads. */
function fakeCommand(argNames: string[], opts: Record<string, unknown>): Command {
  return {
    registeredArguments: argNames.map((name) => ({ name: () => name })),
    opts: () => opts,
    optsWithGlobals: () => opts,
  } as unknown as Command;
}

const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

afterEach(() => {
  exitSpy.mockClear();
});

describe("prepareOrchestrator", () => {
  it("derives options from commander's parsed flags and named arguments", async () => {
    let seen: unknown;
    const handler = prepareOrchestrator(captureLogger, (_ctx, options) => {
      seen = options;

      return Promise.resolve("ok" as const);
    });

    await handler("some/doc.md", fakeCommand(["target"], { verbose: true }));

    expect(seen).toEqual({ target: "some/doc.md", verbose: true });
  });

  it("camelCases multi-word argument names the way commander does its flags", async () => {
    let seen: unknown;
    const handler = prepareOrchestrator(captureLogger, (_ctx, options) => {
      seen = options;

      return Promise.resolve("ok" as const);
    });

    await handler("./proj", fakeCommand(["target-dir"], {}));

    expect(seen).toEqual({ targetDir: "./proj" });
  });

  it("lets extra supply what the CLI surface cannot, winning over parsed input", async () => {
    let seen: unknown;
    const handler = prepareOrchestrator(
      captureLogger,
      (_ctx, options: { ci?: boolean; strict?: boolean }) => {
        seen = options;

        return Promise.resolve("ok" as const);
      },
      { ci: true },
    );

    await handler(fakeCommand([], { strict: true, ci: false }));

    expect(seen).toEqual({ strict: true, ci: true });
  });

  it("builds the context per dispatch, not per preparation", async () => {
    let built = 0;
    const handler = prepareOrchestrator(
      () => {
        built++;
        return captureLogger();
      },
      () => Promise.resolve("ok" as const),
    );

    expect(built).toBe(0);

    await handler(fakeCommand([], {}));
    await handler(fakeCommand([], {}));

    expect(built).toBe(2);
  });

  it("exits 1 on a 'failed' outcome — a legitimate result, nothing logged", async () => {
    const captured = captureLogger();
    const handler = prepareOrchestrator(
      () => captured,
      () => Promise.resolve("failed" as const),
    );

    await handler(fakeCommand([], {}));

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(captured.output()).toBe("");
  });

  it("exits cleanly on an ok or void outcome", async () => {
    const handler = prepareOrchestrator(captureLogger, () => Promise.resolve("ok" as const));

    await handler(fakeCommand([], {}));

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("logs a thrown error to stderr and exits 1", async () => {
    const captured = captureLogger();
    const handler = prepareOrchestrator(
      () => captured,
      () => Promise.reject(new Error("no reviewer named bogus")),
    );

    await handler(fakeCommand([], {}));

    expect(captured.output()).toBe("[ERROR] no reviewer named bogus\n");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with what exitCodeFor says about a thrown error", async () => {
    const captured = captureLogger();
    const usageError = new Error("unknown flag");
    const exitCodeFor = (err: unknown) => (err === usageError ? 2 : 1);
    const handler = prepareOrchestrator(
      () => captured,
      () => Promise.reject(usageError),
      {},
      exitCodeFor,
    );

    await handler(fakeCommand([], {}));

    expect(captured.output()).toBe("[ERROR] unknown flag\n");
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exitCodeFor never touches a 'failed' outcome — that is exit 1 by contract", async () => {
    const handler = prepareOrchestrator(
      captureLogger,
      () => Promise.resolve("failed" as const),
      {},
      () => 2,
    );

    await handler(fakeCommand([], {}));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
