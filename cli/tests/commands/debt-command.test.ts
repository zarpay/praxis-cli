import { describe, expect, it } from "vitest";

import debtCommand from "@/commands/debt-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("debtCommand", () => {
  const helps = registeredHelps(debtCommand);

  it("registers the group and its report subcommand", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual(["debt", "debt report"]);
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
