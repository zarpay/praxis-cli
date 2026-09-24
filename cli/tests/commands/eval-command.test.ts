import { describe, expect, it } from "vitest";

import evalCommand from "@/commands/eval-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("evalCommand", () => {
  const helps = registeredHelps(evalCommand);

  it("registers the group and its seven subcommands", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual([
      "eval",
      "eval run",
      "eval ci",
      "eval critiques",
      "eval review",
      "eval prune",
      "eval report",
      "eval verdict",
    ]);
  });

  it.each(helps)("help for `$path` ends in a site docs link", ({ help }) => {
    expect(help).toContain(DOCS_LINK);
  });

  it.each(helps.filter((entry) => entry.leaf))(
    "help for `$path` states when to use it",
    ({ help }) => {
      expect(help).toContain("When to use");
    },
  );
});
