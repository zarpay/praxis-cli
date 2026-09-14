import { palette } from "@framework/views/palette.js";

/**
 * A path with its directory receding and its final segment forward.
 *
 * Stream headings print whole paths, and a wall of equal-weight path
 * text is unreadable: the directory is provenance (meta), the file is
 * what the line is about (structure). Takes the halves already split —
 * the framework owns no path math, so `dir` carries its own trailing
 * separator and no separator is ever named here.
 */
export function pathLabel({ dir, name }: { dir: string; name: string }): string {
  if (dir === "") return palette.structure(name);

  return `${palette.meta(dir)}${palette.structure(name)}`;
}
