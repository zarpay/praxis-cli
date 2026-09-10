import { palette } from "@framework/views/palette.js";
import { table } from "@framework/views/table.js";

/** What a report opens with: its name and its scope facts. */
interface FrameData {
  /** The report's name, rendered bold. */
  title: string;
  /**
   * The scope facts, as named cells: one small outlined table with the
   * fact names as headers and one row of values (owner, 2026-09-10:
   * datapoints never share an unstructured line).
   */
  facts?: [name: string, value: string | number][];
}

/**
 * The report frame: every report opens the same way — a bold title,
 * then its scope facts in named cells of a small table. Banners
 * (calibration, staleness) stay on the warning channel above or below;
 * the frame carries structure, not judgment.
 */
export function frame({ title, facts = [] }: FrameData): string[] {
  const heading = palette.structure(title);

  if (facts.length === 0) return [heading];

  const headers = facts.map(([name]) => name);
  const row = facts.map(([, value]) => String(value));

  return [heading, "", ...table([row], headers)];
}
