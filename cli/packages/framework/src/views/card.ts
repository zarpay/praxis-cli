import { padPrintable, palette, printableWidth, stripAnsi } from "@framework/views/palette.js";

/** Indent every card line carries. */
const INDENT = "  ";

/** Minimum inner width, so short cards still read as cards. */
const MIN_INNER = 56;

/** Maximum inner width; longer body lines word-wrap to it. */
const MAX_INNER = 72;

/** One key-value attribute row on a card. */
type CardAttr = [key: string, value: string];

/** What a card renders: a title bar, attributes, body, and a footer. */
interface CardData {
  /** The title, rendered bold in the top border. */
  title: string;
  /** Key-value rows; keys align and render as metadata. */
  attrs?: CardAttr[];
  /** Free lines below the attributes — pre-wrapped by the caller. */
  body?: string[];
  /** Closing line(s), separated from the body. */
  footer?: string | string[];
}

/**
 * The standard card (owner, 2026-09-10): a framed block with a titled
 * top border, aligned key-value attributes, body text, and a footer —
 * the one shape for anything shown one-thing-at-a-time (a critique, a
 * cluster, a cached report).
 *
 * The frame renders through `palette.meta` so content pops; the width
 * grows to the longest line. Values and body lines may arrive
 * pre-styled — padding is ANSI-aware.
 */
export function card({ title, attrs = [], body = [], footer }: CardData): string[] {
  const keyWidth = Math.max(0, ...attrs.map(([key]) => key.length));
  const attrLines = attrs.map(([key, value]) => `${palette.meta(key.padEnd(keyWidth))}  ${value}`);

  const wrapped = body.flatMap((line) => wrap(line, MAX_INNER));
  const content: string[] = [...attrLines];

  if (wrapped.length > 0) {
    if (content.length > 0) content.push("");

    content.push(...wrapped);
  }

  if (footer !== undefined) {
    if (content.length > 0) content.push("");

    content.push(...(Array.isArray(footer) ? footer : [footer]));
  }

  // Body wraps to MAX_INNER; a longer attribute (a deep path) widens
  // the card instead of breaking its wall.
  const inner = Math.max(
    MIN_INNER,
    printableWidth(title) + 2,
    ...content.map((line) => printableWidth(line)),
  );

  const top =
    palette.meta("╭─ ") +
    palette.structure(title) +
    " " +
    palette.meta("─".repeat(Math.max(1, inner - printableWidth(title) - 1)) + "╮");
  const bottom = palette.meta("╰" + "─".repeat(inner + 2) + "╯");
  const wall = palette.meta("│");
  const framed = content.map((line) => `${wall} ${padPrintable(line, inner)} ${wall}`);

  return [INDENT + top, ...framed.map((line) => INDENT + line), INDENT + bottom];
}

/**
 * Word-wraps one plain line to a width, with a hanging indent so a
 * wrapped bullet's continuation lines align under its text. A
 * pre-styled line (carrying ANSI codes) is passed through untouched —
 * the caller sized it.
 */
function wrap(line: string, width: number): string[] {
  if (printableWidth(line) <= width || line !== stripAnsi(line)) return [line];

  const lead = /^(\s*(?:- )?)/.exec(line)?.[1] ?? "";
  const hang = " ".repeat(lead.length);
  const words = line.slice(lead.length).split(" ");
  const lines: string[] = [];
  let current = lead;

  for (const word of words) {
    const prefix = lines.length === 0 ? lead : hang;

    if (current !== prefix && current.length + 1 + word.length > width) {
      lines.push(current);
      current = `${hang}${word}`;
    } else {
      current = current === prefix ? `${current}${word}` : `${current} ${word}`;
    }
  }

  if (current.trim() !== "") lines.push(current);

  return lines;
}
