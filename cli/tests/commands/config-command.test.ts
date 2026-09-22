import { describe, expect, it } from "vitest";

import configCommand from "@/commands/config-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("configCommand", () => {
  const helps = registeredHelps(configCommand);

  it("registers the group and its two subcommands", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual(["config", "config show", "config edit"]);
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
