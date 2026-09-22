import { describe, expect, it } from "vitest";

import initCommand from "@/commands/init-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("initCommand", () => {
  const helps = registeredHelps(initCommand);

  it("registers the init command", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual(["init"]);
  });

  it.each(helps)("help for `$path` is agent-grade", ({ help }) => {
    expect(help).toContain(DOCS_LINK);
    expect(help).toContain("When to use");
  });
});
