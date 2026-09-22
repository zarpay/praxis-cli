import { describe, expect, it } from "vitest";

import axiomsCommand from "@/commands/axioms-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("axiomsCommand", () => {
  const helps = registeredHelps(axiomsCommand);

  it("registers the group and its seven subcommands", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual([
      "axioms",
      "axioms list",
      "axioms show",
      "axioms triage",
      "axioms curate",
      "axioms reassign",
      "axioms deprecate",
      "axioms merge",
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
