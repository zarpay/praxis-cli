import { randomBytes } from "node:crypto";

/**
 * Mints a sortable, filename-safe, collision-safe id: the UTC instant
 * to the millisecond plus 32 random bits.
 *
 * Lexicographic order is chronological order, and the random suffix
 * keeps same-millisecond writers (a multi-reviewer fan-out, two
 * machines) from colliding — the same reasoning as axiom ids: nothing
 * praxis mints is ever sequential.
 */
export function sortableId(): string {
  const instant = new Date().toISOString().replace(/[-:.]/g, "");

  return `${instant}-${randomBytes(4).toString("hex")}`;
}
