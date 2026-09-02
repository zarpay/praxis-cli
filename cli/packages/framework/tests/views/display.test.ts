import chalk from "chalk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Display } from "@framework/views/display.js";

describe("Display", () => {
  let logged: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = [];
    spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logged.push(args.join(" "));
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  describe("print() — plain and skipped entries", () => {
    it("writes each string entry on its own line in order", () => {
      new Display().print(["first", "second", "third"]);

      expect(logged).toEqual(["first", "second", "third"]);
    });

    it("renders empty strings as blank lines", () => {
      new Display().print(["", "body", ""]);

      expect(logged).toEqual(["", "body", ""]);
    });

    it("skips null, false, and undefined entries so conditionals inline", () => {
      const shown = false;

      new Display().print(["kept", null, shown && "skipped", undefined, "also kept"]);

      expect(logged).toEqual(["kept", "also kept"]);
    });
  });

  describe("print() — text entries", () => {
    it("colors a text entry with the named chalk style", () => {
      new Display().print([{ text: "  ! Document has changed", color: "yellow" }]);

      expect(logged).toEqual([chalk.yellow("  ! Document has changed")]);
    });

    it("renders a text entry without color as plain text", () => {
      new Display().print([{ text: "plain body" }]);

      expect(logged).toEqual(["plain body"]);
    });
  });

  describe("print() — badge entries", () => {
    it("renders a colored bracket label followed by the value", () => {
      new Display().print([{ badge: "PASS", color: "green", value: "docs/guide.md" }]);

      expect(logged).toEqual([`${chalk.green("[PASS]")} docs/guide.md`]);
    });

    it("accepts numeric values directly", () => {
      new Display().print([{ badge: "Errors", color: "red", value: 3 }]);

      expect(logged).toEqual([`${chalk.red("[Errors]")} 3`]);
    });

    it("renders the label alone when no value is given", () => {
      new Display().print([{ badge: "STOPPED", color: "yellow" }]);

      expect(logged).toEqual([chalk.yellow("[STOPPED]")]);
    });

    it("indents by the requested width", () => {
      new Display().print([{ badge: "FAIL", color: "red", value: 3, indent: 2 }]);

      expect(logged).toEqual([`  ${chalk.red("[FAIL]")} 3`]);
    });
  });

  describe("print() — header entries", () => {
    it("renders the title between divider lines", () => {
      new Display().print([{ header: "Summary" }]);

      expect(logged).toEqual(["=".repeat(50), "Summary", "=".repeat(50)]);
    });

    it("honors a custom divider character and width", () => {
      new Display().print([{ header: "AI Reasoning:", char: "-", width: 10 }]);

      expect(logged).toEqual(["----------", "AI Reasoning:", "----------"]);
    });
  });

  describe("print() — a whole block as one payload", () => {
    it("renders mixed entry kinds in order", () => {
      const notValidated = 0;

      new Display().print([
        "",
        { header: "Summary" },
        "Total documents: 12",
        { badge: "Compliant", color: "green", value: 9 },
        notValidated > 0 && { badge: "Not Validated", color: "gray", value: notValidated },
        "",
        { text: "done", color: "dim" },
      ]);

      expect(logged).toEqual([
        "",
        "=".repeat(50),
        "Summary",
        "=".repeat(50),
        "Total documents: 12",
        `${chalk.green("[Compliant]")} 9`,
        "",
        chalk.dim("done"),
      ]);
    });
  });

  describe("line()", () => {
    it("writes a single entry", () => {
      new Display().line("Validating docs/guide.md...");

      expect(logged).toEqual(["Validating docs/guide.md..."]);
    });

    it("writes a blank line when called with no argument", () => {
      new Display().line();

      expect(logged).toEqual([""]);
    });
  });
});
