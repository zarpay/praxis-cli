import { describe, expect, it } from "vitest";

import compileCommand from "@/commands/compile-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("compileCommand", () => {
  const helps = registeredHelps(compileCommand);

  it("registers the compile command", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual(["compile"]);
  });

  it.each(helps)("help for `$path` is agent-grade", ({ help }) => {
    expect(help).toContain(DOCS_LINK);
    expect(help).toContain("When to use");
  });
});
