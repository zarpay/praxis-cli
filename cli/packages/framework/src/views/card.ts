import { stdout } from "node:process";

import { padPrintable, palette, printableWidth, stripAnsi } from "@framework/views/palette.js";

/** Indent every card line carries. */
const INDENT = "  ";

/** Columns the frame itself costs: the indent, plus `│ ` and ` │`. */
const FRAME_COST = INDENT.length + 4;

/** Minimum inner width, so short cards still read as cards. */
const MIN_INNER = 56;

/** Maximum inner width; longer lines wrap to it. */
const MAX_INNER = 72;

/** Narrowest inner width worth framing, for a genuinely tiny terminal. */
const FLOOR_INNER = 24;

/** Width assumed when the output is not a terminal (piped, redirected, CI). */
const ASSUMED_COLUMNS = 80;

/** Gap between an attribute's key column and its value. */
const KEY_GAP = 2;

/** Ends a run of styling, so a wrapped line never bleeds into the frame. */
const RESET = "\u001b[0m";

/** One printable character, with the styling active at that point. */
interface StyledChar {
  char: string;
  codes: OpenCode[];
}

/** One key-value attribute row on a card. */
type CardAttr = [key: string, value: string];

/** What a card renders: a title bar, attributes, body, and a footer. */
interface CardData {
  /** The title, rendered bold in the top border. */
  title: string;
  /** Key-value rows; keys align and render as metadata. */
  attrs?: CardAttr[];
  /** Free lines below the attributes. */
  body?: string[];
  /** Closing line(s), separated from the body. */
  footer?: string | string[];
  /**
   * Columns available for the whole card. Defaults to the terminal's
   * width — pass it explicitly in a test, or to fit a narrower column.
   */
  width?: number;
}

/**
 * The standard card (owner, 2026-09-10): a framed block with a titled
 * top border, aligned key-value attributes, body text, and a footer —
 * the one shape for anything shown one-thing-at-a-time (a critique, a
 * cluster, a cached report).
 *
 * The frame renders through `palette.meta` so content pops. **The card
 * never outgrows the terminal**: every line — styled text, a deep path
 * in an attribute, a title, an unbroken URL — wraps to the available
 * width, because a frame wider than the window is re-wrapped by the
 * terminal and stops being a frame at all.
 */
export function card({ title, attrs = [], body = [], footer, width }: CardData): string[] {
  const inner = innerWidth(width);
  const keyWidth = Math.max(0, ...attrs.map(([key]) => key.length));
  const attrLines = attrs.flatMap(([key, value]) => attrRow(key, value, keyWidth, inner));

  const wrapped = body.flatMap((line) => wrap(line, inner));
  const content: string[] = [...attrLines];

  if (wrapped.length > 0) {
    if (content.length > 0) content.push("");

    content.push(...wrapped);
  }

  if (footer !== undefined) {
    const lines = Array.isArray(footer) ? footer : [footer];

    if (content.length > 0) content.push("");

    content.push(...lines.flatMap((line) => wrap(line, inner)));
  }

  // Two columns short of the inner width, so the rule that closes the
  // top border always has at least one dash to draw and the border
  // cannot end up a column wider than the walls below it.
  const heading = truncate(title, inner - 2);
  const rule = "─".repeat(Math.max(1, inner - printableWidth(heading) - 1));
  const top = `${palette.meta("╭─ ")}${palette.structure(heading)} ${palette.meta(`${rule}╮`)}`;
  const bottom = palette.meta(`╰${"─".repeat(inner + 2)}╯`);
  const wall = palette.meta("│");
  const framed = content.map((line) => `${wall} ${padPrintable(line, inner)} ${wall}`);

  return [INDENT + top, ...framed.map((line) => INDENT + line), INDENT + bottom];
}

/**
 * The content width the frame is drawn at.
 *
 * Prefers the standard width, gives it up when the terminal is
 * narrower, and stops giving it up at a floor — below that a card is
 * unreadable either way, and the terminal's own wrapping is no worse.
 */
function innerWidth(available?: number): number {
  const columns = available ?? stdout.columns ?? ASSUMED_COLUMNS;
  const fits = columns - FRAME_COST;

  if (fits <= MIN_INNER) return Math.max(FLOOR_INNER, fits);

  return Math.min(MAX_INNER, fits);
}

/**
 * One attribute as its key column plus the value, the value wrapped
 * with a hanging indent so continuation lines align under it rather
 * than under the key.
 */
function attrRow(key: string, value: string, keyWidth: number, inner: number): string[] {
  const gutter = " ".repeat(keyWidth + KEY_GAP);
  const [first = "", ...rest] = wrap(value, Math.max(FLOOR_INNER, inner - gutter.length));

  return [
    `${palette.meta(key.padEnd(keyWidth))}${" ".repeat(KEY_GAP)}${first}`,
    ...rest.map((line) => `${gutter}${line}`),
  ];
}

/** The text, cut to fit with an ellipsis standing in for what was cut. */
function truncate(text: string, width: number): string {
  if (printableWidth(text) <= width) return text;

  const cells = styledCells(text).slice(0, Math.max(0, width - 1));

  return `${render(cells)}…`;
}

/**
 * Word-wraps one line to a width, with a hanging indent so a wrapped
 * bullet's continuation lines align under its text.
 *
 * Styling survives the break: each emitted line reopens whatever codes
 * were active where it starts and closes them at its end, so a wrapped
 * dim critique stays dim to its last line and no run leaks into the
 * frame. A word longer than the width — a URL, a deep path — is cut
 * rather than allowed to push the wall out.
 */
function wrap(line: string, width: number): string[] {
  if (printableWidth(line) <= width) return [line];

  const lead = /^(\s*(?:- )?)/.exec(stripAnsi(line))?.[1] ?? "";
  const hang = " ".repeat(lead.length);
  const room = Math.max(1, width - lead.length);
  const cells = styledCells(line).slice(lead.length);
  const pieces = words(cells).flatMap((word) => chunks(word, room));

  const lines: string[] = [];
  let current: StyledChar[] = [];

  for (const piece of pieces) {
    const spaced = current.length > 0 ? current.length + 1 + piece.length : piece.length;

    if (current.length > 0 && spaced > room) {
      lines.push(render(current));
      current = piece;
    } else {
      current = current.length > 0 ? [...current, space(), ...piece] : piece;
    }
  }

  if (current.length > 0) lines.push(render(current));

  return lines.map((text, index) => `${index === 0 ? lead : hang}${text}`);
}

/** The line split on spaces, empty runs dropped. */
function words(cells: StyledChar[]): StyledChar[][] {
  const split: StyledChar[][] = [[]];

  for (const cell of cells) {
    if (cell.char === " ") split.push([]);
    else split[split.length - 1]?.push(cell);
  }

  return split.filter((word) => word.length > 0);
}

/** A word in slices of at most `size`, so an unbreakable token still fits. */
function chunks(word: StyledChar[], size: number): StyledChar[][] {
  if (word.length <= size) return [word];

  const slices: StyledChar[][] = [];

  for (let start = 0; start < word.length; start += size) {
    slices.push(word.slice(start, start + size));
  }

  return slices;
}

/** An unstyled space, for rejoining words. */
function space(): StyledChar {
  return { char: " ", codes: [] };
}

/**
 * One SGR escape sequence, capturing its numeric parameter.
 *
 * The one place an escape is matched, so the lint exemption is stated
 * once rather than at every use.
 */
// eslint-disable-next-line no-control-regex -- matching the escape sequences is the point
const SGR = /\u001b\[([0-9;]*)m/g;

/** One open SGR code: the sequence to re-emit, and the parameter it set. */
interface OpenCode {
  sequence: string;
  value: number;
}

/**
 * The string as printable characters, each carrying the SGR codes open
 * at that point.
 *
 * Chalk emits paired codes — `2m`…`22m`, `90m`…`39m` — so a closing
 * code drops the opener it answers and `0m` drops everything. That is
 * enough to know, at any character, exactly what styling is in force.
 */
function styledCells(text: string): StyledChar[] {
  const cells: StyledChar[] = [];
  let codes: OpenCode[] = [];
  let index = 0;

  for (const match of text.matchAll(SGR)) {
    cells.push(...plainCells(text.slice(index, match.index), codes));
    codes = applyCode(codes, { sequence: match[0], value: Number(match[1] || "0") });
    index = match.index + match[0].length;
  }

  cells.push(...plainCells(text.slice(index), codes));

  return cells;
}

/** A run of unstyled text as cells, all carrying the same codes. */
function plainCells(text: string, codes: OpenCode[]): StyledChar[] {
  return [...text].map((char) => ({ char, codes }));
}

/** The open codes after one escape: an opener joins, a closer removes. */
function applyCode(open: OpenCode[], code: OpenCode): OpenCode[] {
  if (code.value === 0) return [];

  const closes = CLOSERS[code.value];

  if (closes) return open.filter((held) => !closes.includes(held.value));

  return [...open, code];
}

/** Which openers each closing SGR code answers. */
const CLOSERS: Record<number, number[]> = {
  22: [1, 2],
  23: [3],
  24: [4],
  27: [7],
  29: [9],
  39: [...range(30, 37), ...range(90, 97)],
  49: [...range(40, 47), ...range(100, 107)],
};

/** The inclusive run of numbers from `from` to `to`. */
function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, step) => from + step);
}

/** Cells back to a string, reopening styling at each change and closing at the end. */
function render(cells: StyledChar[]): string {
  let text = "";
  let open: OpenCode[] = [];

  for (const cell of cells) {
    // Identity, not deep equality: a run of characters shares the one
    // array `styledCells` built for it, so this changes exactly where
    // the styling does.
    if (cell.codes !== open) {
      if (open.length > 0) text += RESET;

      text += cell.codes.map((code) => code.sequence).join("");
      open = cell.codes;
    }

    text += cell.char;
  }

  return open.length > 0 ? `${text}${RESET}` : text;
}
