import { describe, expect, it } from "vitest";

import feedbackCommand from "@/commands/feedback-command.js";
import { DOCS_LINK, registeredHelps } from "@tests/helpers/command-help.js";

describe("feedbackCommand", () => {
  const helps = registeredHelps(feedbackCommand);

  it("registers the feedback command", () => {
    const paths = helps.map((entry) => entry.path);

    expect(paths).toEqual(["feedback"]);
  });

  it.each(helps)("help for `$path` is agent-grade", ({ help }) => {
    expect(help).toContain(DOCS_LINK);
    expect(help).toContain("When to use");
  });
});
