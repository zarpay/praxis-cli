import { describe, expect, it } from "vitest";

import statusCommand from "@/commands/status-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("statusCommand", () => {
  const helps = registeredHelps(statusCommand);

  it("registers the status command", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual(["status"]);
  });

  it.each(helps)("help for `$path` is agent-grade", ({ help }) => {
    expect(help).toContain(DOCS_LINK);
    expect(help).toContain("When to use");
  });
});
