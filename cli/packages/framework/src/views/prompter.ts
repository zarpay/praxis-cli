import type { Interface } from "node:readline/promises";

import { stdin, stderr } from "node:process";
import { createInterface } from "node:readline/promises";

/**
 * The framework's one interactive input channel.
 *
 * Questions go to stderr — stdout stays data (09) — and answers come
 * from stdin. Callers check `interactive` before prompting and raise
 * their instructive not-a-TTY error themselves, so every interactive
 * command names its own scripting flags. Tests inject streams.
 */
export class Prompter {
  private readonly input: NodeJS.ReadableStream & { isTTY?: boolean };
  private readonly output: NodeJS.WritableStream;
  private rl: Interface | null = null;

  constructor({
    input = stdin,
    output = stderr,
  }: {
    input?: NodeJS.ReadableStream & { isTTY?: boolean };
    output?: NodeJS.WritableStream;
  } = {}) {
    this.input = input;
    this.output = output;
  }

  /** Whether a human is on the other end of stdin. */
  get interactive(): boolean {
    return this.input.isTTY === true;
  }

  /**
   * Asks one free-text question; the trimmed answer.
   */
  async ask(question: string): Promise<string> {
    const answer = await this.readline().question(`${question} `);

    return answer.trim();
  }

  /**
   * Offers keyed choices (`[a]ccept / [d]ismiss / [s]kip`) and repeats
   * the question until an offered key is typed. Answers are matched on
   * their first character, case-insensitively.
   */
  async choose(question: string, keys: string[]): Promise<string> {
    for (;;) {
      const answer = (await this.ask(question)).toLowerCase();

      const match = keys.find((key) => answer.length > 0 && key.startsWith(answer[0]));

      if (match) return match;
    }
  }

  /** A yes/no question; only `y`/`yes` is true. */
  async confirm(question: string): Promise<boolean> {
    const answer = await this.choose(`${question} [y/n]`, ["yes", "no"]);

    return answer === "yes";
  }

  /** Releases stdin; call once when the session ends. */
  close(): void {
    this.rl?.close();
    this.rl = null;
  }

  /** The readline interface, created on first use. */
  private readline(): Interface {
    this.rl ??= createInterface({ input: this.input, output: this.output, terminal: false });

    return this.rl;
  }
}
