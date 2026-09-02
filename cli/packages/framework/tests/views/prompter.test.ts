import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import { Prompter } from "@framework/views/prompter.js";

/** A prompter fed by a scripted stdin, its questions captured. */
function scriptedPrompter(answers: string[]): { prompter: Prompter; asked: () => string } {
  const input = new PassThrough();
  const output = new PassThrough();
  let captured = "";

  output.on("data", (chunk: Buffer) => {
    captured += String(chunk);
  });

  const prompter = new Prompter({ input, output });
  const queue = [...answers];

  // One answer per question: readline drops lines that arrive while no
  // question is pending, so each prompt write feeds the next answer.
  output.on("data", () => {
    const next = queue.shift();

    if (next !== undefined) input.write(`${next}\n`);
  });

  return { prompter, asked: () => captured };
}

describe("Prompter", () => {
  it("is not interactive on a non-TTY stream", () => {
    const { prompter } = scriptedPrompter([]);

    expect(prompter.interactive).toBe(false);
  });

  it("asks and returns the trimmed answer", async () => {
    const { prompter, asked } = scriptedPrompter(["  yes please  "]);

    const answer = await prompter.ask("Reason?");

    expect(answer).toBe("yes please");
    expect(asked()).toContain("Reason?");
    prompter.close();
  });

  it("chooses by first letter, re-asking until an offered key arrives", async () => {
    const { prompter } = scriptedPrompter(["x", "", "D"]);

    const choice = await prompter.choose("[a]ccept / [d]ismiss / [s]kip", [
      "accept",
      "dismiss",
      "skip",
    ]);

    expect(choice).toBe("dismiss");
    prompter.close();
  });

  it("confirms only on yes", async () => {
    const { prompter } = scriptedPrompter(["n"]);

    const confirmed = await prompter.confirm("Ratify?");

    expect(confirmed).toBe(false);
    prompter.close();
  });
});
