import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import newAxiomIdService from "@/services/new-axiom-id-service.js";

describe("newAxiomIdService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-axiom-id-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("mints AX- plus 6 lowercase hex", () => {
    const id = newAxiomIdService({ root });

    expect(id).toMatch(/^AX-[0-9a-f]{6}$/);
  });

  it("mints distinct ids across calls — random, never sequential", () => {
    const ids = new Set([
      newAxiomIdService({ root }),
      newAxiomIdService({ root }),
      newAxiomIdService({ root }),
    ]);

    expect(ids.size).toBe(3);
  });

  it("never returns an id already present in the store or its proposals", () => {
    // Occupy ids by placing files; the mint must avoid whatever exists.
    const activeDir = join(root, ".praxis", "axioms");
    const proposedDir = join(activeDir, "proposed");
    mkdirSync(proposedDir, { recursive: true });

    const minted = newAxiomIdService({ root });
    writeFileSync(join(activeDir, `${minted}.md`), "taken");

    const second = newAxiomIdService({ root });
    writeFileSync(join(proposedDir, `${second}.md`), "taken");

    const third = newAxiomIdService({ root });

    expect(second).not.toBe(minted);
    expect(third).not.toBe(minted);
    expect(third).not.toBe(second);
  });
});
