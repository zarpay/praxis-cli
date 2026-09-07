import { describe, expect, it } from "vitest";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

describe("preparePrompt", () => {
  it("wraps a template into a prompt that fills its placeholders", () => {
    const greet = preparePrompt<{ name: string; day: string }>("Hello {name}, happy {day}.");

    const rendered = greet({ name: "Ada", day: "Tuesday" });

    expect(rendered).toBe("Hello Ada, happy Tuesday.");
  });

  it("replaces every occurrence of a repeated placeholder", () => {
    const echo = preparePrompt<{ word: string }>("{word} and {word} again");

    const rendered = echo({ word: "once" });

    expect(rendered).toBe("once and once again");
  });

  it("wraps a slotless template into a plain prompt taking no variables", () => {
    const plain = preparePrompt("Just the text.");

    const rendered = plain();

    expect(rendered).toBe("Just the text.");
  });

  it("throws when a supplied variable has no placeholder in the template", () => {
    const greet = preparePrompt<{ name: string }>("Hello {title}.");

    const render = () => greet({ name: "Ada" });

    expect(render).toThrow('Unmatched template variable: "name"');
  });
});
