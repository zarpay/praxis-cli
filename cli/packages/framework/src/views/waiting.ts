import { stderr } from "node:process";

import { palette } from "@framework/views/palette.js";

/**
 * Frames the spinner cycles through, one per repaint.
 *
 * Every frame fills the whole braille cell bar one dot, so the glyph
 * keeps a constant weight and sits on the row's baseline like the text
 * beside it. The lighter two-dot arc (`⠋⠙⠹…`) reads as floating above
 * the line, because most of its frames only use the upper rows.
 */
const FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

/**
 * How often the line repaints — fast enough to read as motion rather
 * than as a clock that happens to tick. The elapsed seconds recompute
 * on every repaint and simply change less often than the frame does.
 */
const REPAINT_MS = 80;

/** Carriage return, then erase from the cursor to the end of the line. */
const CLEAR_LINE = "\r\u001b[K";

/**
 * The channel that says work is in flight.
 *
 * A model call can take ninety seconds, and a terminal that prints
 * nothing for ninety seconds reads as a hung process — people Ctrl-C out
 * of sessions that are working fine. This holds one line on stderr,
 * repainting a spinner and a climbing clock, for exactly as long as the
 * call runs.
 *
 * Where {@link Display} carries output and {@link Logger} carries
 * diagnostics, this carries duration, and it carries nothing afterwards:
 * the line is erased when the work settles, leaving no trace in the
 * scrollback.
 *
 * Animation needs a TTY, and off one this writes nothing at all. A
 * reader who cannot see a line repaint has no use for one, and the
 * commands that wait already narrate themselves through {@link Logger} —
 * which is where non-interactive commentary belongs. Piped, redirected,
 * in CI or under test, this channel is silent; stdout never sees it
 * either way.
 */
export class Waiting {
  private readonly output: NodeJS.WritableStream & { isTTY?: boolean };
  private readonly animated: boolean;
  private timer: NodeJS.Timeout | null = null;
  private label = "";
  private startedAt = 0;
  private frame = 0;

  constructor({ output = stderr }: { output?: NodeJS.WritableStream & { isTTY?: boolean } } = {}) {
    this.output = output;
    this.animated = output.isTTY === true;
  }

  /**
   * Runs `work`, holding `label` and a clock on screen until it settles.
   *
   * The form to reach for, because it cannot be got wrong: the close
   * happens in a `finally`, so a throwing call cannot strand a line over
   * the output that follows it.
   */
  async during<Result>(label: string, work: () => Promise<Result>): Promise<Result> {
    this.open(label);

    try {
      return await work();
    } finally {
      this.close();
    }
  }

  /**
   * Shows `label` and starts the clock.
   *
   * The event-driven form, for a wait whose two ends arrive as separate
   * callbacks — `eval run` opens on `unit-start` and closes on the
   * verdict. Prefer {@link during} wherever one `await` spans the wait,
   * and where this pair is used, close it from a `finally` around the
   * whole stream. Opening twice closes the first line.
   */
  open(label: string): void {
    this.close();

    if (!this.animated) return;

    this.label = label;
    this.startedAt = Date.now();
    this.frame = 0;

    this.paint();

    // Unref'd so a pending repaint can never hold the process open — an
    // interval that outlives its work hangs the test suite.
    this.timer = setInterval(() => {
      this.frame++;
      this.paint();
    }, REPAINT_MS);
    this.timer.unref();
  }

  /** Stops the clock and erases the line. Safe to call when idle. */
  close(): void {
    if (this.timer === null) return;

    clearInterval(this.timer);
    this.timer = null;
    this.erase();
  }

  /**
   * Clears the line, runs `write`, then repaints.
   *
   * Anything else writing to stderr mid-wait would interleave with the
   * repaint and corrupt both. Callers that stream their own output while
   * a wait runs — triage renders a line per critique as it lands — put
   * that write through here.
   */
  paused(write: () => void): void {
    if (this.timer === null) {
      write();

      return;
    }

    this.erase();
    write();
    this.paint();
  }

  /** Writes the current frame of the line. */
  private paint(): void {
    const spinner = FRAMES[this.frame % FRAMES.length];
    const clock = elapsed(Date.now() - this.startedAt);

    this.output.write(
      `${CLEAR_LINE}${palette.meta(spinner)} ${palette.structure(this.label)} ${palette.meta(`— ${clock}`)}`,
    );
  }

  /** Removes the line, leaving the cursor where it started. */
  private erase(): void {
    this.output.write(CLEAR_LINE);
  }
}

/** A duration as `m:ss`, counting up without a ceiling. */
function elapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
