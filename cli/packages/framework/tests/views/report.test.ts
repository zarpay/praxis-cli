import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Logger } from "@framework/views/logger.js";
import { renderReport } from "@framework/views/report.js";

describe("renderReport", () => {
  let logged: string;
  let logger: Logger;
  let stdout: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = "";
    logger = new Logger({
      color: false,
      output: new Writable({
        write(chunk, _enc, cb) {
          logged += String(chunk);
          cb();
        },
      }),
    });
    stdout = [];
    spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(args.join(" "));
    });
  });

  afterEach(() => spy.mockRestore());

  it("routes headings, warnings and successes to the logger", () => {
    renderReport(
      [
        { channel: "heading", text: "Report" },
        { channel: "warning", text: "careful" },
        { channel: "success", text: "done" },
      ],
      { logger },
    );

    expect(logged).toBe("[INFO] Report\n[WARN] careful\n[OK] done\n");
    expect(stdout).toEqual([]);
  });

  it("routes content and blanks to stdout", () => {
    renderReport([{ channel: "content", entries: ["hello"] }, { channel: "blank" }], { logger });

    expect(stdout.join("\n")).toContain("hello");
    expect(logged).toBe("");
  });

  it("preserves the report's order across both channels", () => {
    const order: string[] = [];
    const trackingLogger = new Logger({
      color: false,
      output: new Writable({
        write(chunk, _enc, cb) {
          order.push(`err:${String(chunk).trim()}`);
          cb();
        },
      }),
    });
    spy.mockImplementation((...args: unknown[]) => order.push(`out:${args.join(" ")}`));

    renderReport(
      [
        { channel: "heading", text: "first" },
        { channel: "content", entries: ["second"] },
        { channel: "warning", text: "third" },
      ],
      { logger: trackingLogger },
    );

    expect(order).toEqual(["err:[INFO] first", "out:second", "err:[WARN] third"]);
  });
});
