import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stripAnsi } from "@framework/views/palette.js";
import { Waiting } from "@framework/views/waiting.js";

/** A waiting channel over a captured stream, TTY or not. */
function captured(isTTY: boolean): {
  waiting: Waiting;
  written: () => string;
  write: (text: string) => void;
} {
  const output = new PassThrough() as PassThrough & { isTTY?: boolean };
  let text = "";

  output.isTTY = isTTY;
  output.on("data", (chunk: Buffer) => {
    text += String(chunk);
  });

  return {
    waiting: new Waiting({ output }),
    written: () => stripAnsi(text),
    write: (line: string) => void output.write(line),
  };
}

/** A promise resolved by hand, so a wait can be held open. */
function deferred(): { promise: Promise<string>; resolve: () => void } {
  let release: () => void = () => undefined;
  const promise = new Promise<string>((settle) => {
    release = () => settle("done");
  });

  return { promise, resolve: release };
}

describe("Waiting on a TTY", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("paints the label with a clock and repaints as time passes", async () => {
    const { waiting, written } = captured(true);
    const work = deferred();
    const during = waiting.during("Clustering 30 critiques", () => work.promise);

    await vi.advanceTimersByTimeAsync(2000);
    const midFlight = written();

    work.resolve();
    await during;

    expect(midFlight).toContain("Clustering 30 critiques");
    expect(midFlight).toContain("0:00");
    expect(midFlight).toContain("0:02");
  });

  it("erases the line when the work settles, leaving no trace", async () => {
    const { waiting, written } = captured(true);

    await waiting.during("Checking traceability", () => Promise.resolve("ok"));

    expect(written().endsWith("\r\u001b[K")).toBe(true);
  });

  it("erases the line when the work throws, so nothing is stranded", async () => {
    const { waiting, written } = captured(true);
    const boom = waiting.during("Clustering", () => Promise.reject(new Error("curator failed")));

    await expect(boom).rejects.toThrow("curator failed");
    expect(written().endsWith("\r\u001b[K")).toBe(true);
  });

  it("returns the work's own value", async () => {
    const { waiting } = captured(true);

    await expect(waiting.during("Labeling", () => Promise.resolve(42))).resolves.toBe(42);
  });

  it("schedules nothing once the work has settled", async () => {
    const { waiting } = captured(true);

    await waiting.during("Clustering", () => Promise.resolve("ok"));

    expect(vi.getTimerCount()).toBe(0);
  });

  it("opens and closes as a pair, for a wait that spans two callbacks", async () => {
    const { waiting, written } = captured(true);

    waiting.open("Reviewing src/services/apply-discount.ts");
    await vi.advanceTimersByTimeAsync(3000);
    const midFlight = written();

    waiting.close();

    expect(midFlight).toContain("Reviewing src/services/apply-discount.ts");
    expect(midFlight).toContain("0:03");
    expect(written().endsWith("\r\u001b[K")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes the standing line when opened again", async () => {
    const { waiting, written } = captured(true);

    waiting.open("Reviewing first.ts");
    waiting.open("Reviewing second.ts");
    await vi.advanceTimersByTimeAsync(1000);
    waiting.close();

    expect(written()).toContain("Reviewing second.ts");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a close with nothing open", () => {
    const { waiting, written } = captured(true);

    waiting.close();

    expect(written()).toBe("");
  });

  it("clears the line around a write that lands mid-wait", async () => {
    const { waiting, written, write } = captured(true);
    const work = deferred();
    const during = waiting.during("Labeling 12 critiques", () => {
      waiting.paused(() => write("AX-01 labeled\n"));

      return work.promise;
    });

    work.resolve();
    await during;

    const before = written().slice(0, written().indexOf("AX-01 labeled"));

    expect(before).toContain("Labeling 12 critiques");
    expect(before.endsWith("\r\u001b[K")).toBe(true);
  });

  it("repaints after a paused write, so the wait stays visible", async () => {
    const { waiting, written, write } = captured(true);
    const work = deferred();
    const during = waiting.during("Labeling 12 critiques", () => {
      waiting.paused(() => write("AX-01 labeled\n"));

      return work.promise;
    });

    work.resolve();
    await during;

    const after = written().slice(written().indexOf("AX-01 labeled"));

    expect(after).toContain("Labeling 12 critiques");
  });
});

describe("Waiting off a TTY", () => {
  it("stays silent — a line nobody can watch repaint is noise", async () => {
    const { waiting, written } = captured(false);
    const work = deferred();
    const during = waiting.during("Clustering 30 critiques", () => work.promise);

    work.resolve();
    await during;

    expect(written()).toBe("");
  });

  it("still returns the work's value", async () => {
    const { waiting } = captured(false);

    await expect(waiting.during("Labeling", () => Promise.resolve("labeled"))).resolves.toBe(
      "labeled",
    );
  });

  it("writes a paused line straight through, unframed", async () => {
    const { waiting, written, write } = captured(false);

    await waiting.during("Labeling", () => {
      waiting.paused(() => write("AX-01 labeled\n"));

      return Promise.resolve("ok");
    });

    expect(written()).toBe("AX-01 labeled\n");
  });
});
