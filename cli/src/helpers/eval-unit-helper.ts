import type { EvalUnit } from "@/types.js";

/**
 * Whether a unit reviews a set of files rather than the one at its path.
 *
 * A `by_file` unit is its own single member, so its path is its only
 * file; a `by_directory` unit is a directory holding members. The
 * distinction decides how the subject is assembled, what the reviewer
 * is asked about, and how the unit is named on screen — three callers,
 * which is why it has one definition rather than each spelling the
 * comparison itself.
 */
export function isCohortUnit(unit: EvalUnit): boolean {
  return unit.files.length > 1 || unit.files[0] !== unit.path;
}
