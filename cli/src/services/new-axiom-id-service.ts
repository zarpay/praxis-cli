import type { NewAxiomIdInput } from "@/types.js";

import { randomBytes } from "node:crypto";

import { exists } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/**
 * Mints a new axiom id: `AX-` + 6 lowercase hex.
 *
 * Random, never sequential: two contributors triaging on separate
 * branches must not be able to mint the same id for different
 * standards — a merge would silently fuse two meanings under one
 * identity, the exact corruption 04's lifecycle rules exist to prevent.
 * The store check is belt-and-braces for the astronomically unlikely
 * local collision; cross-branch safety comes from the 16.7M-id space.
 */
export default function newAxiomIdService({ root }: NewAxiomIdInput): string {
  const axiomsDir = joinPath(root, ".praxis", "axioms");

  for (;;) {
    const id = `AX-${randomBytes(3).toString("hex")}`;

    const taken =
      exists(joinPath(axiomsDir, `${id}.md`)) ||
      exists(joinPath(axiomsDir, "proposed", `${id}.md`));

    if (!taken) return id;
  }
}
