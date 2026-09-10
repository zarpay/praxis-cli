---
name: consistency-audit
description: Sweep the CLI codebase against the conventions in .claude/rules — structural audits (caller graph, hidden model/store methods, verb vocabulary, types discipline), not just file reads. Run after refactors and periodically.
---

# Consistency Audit

The rules in `.claude/rules/` are only as true as the last sweep. This
skill is the sweep — and it audits **structures** (import graphs,
naming families, type placement), because reading files in isolation
misses exactly the violations that matter. Every finding gets fixed in
the sweep, not listed for later; anything genuinely ambiguous goes to
the owner as a concrete option.

## The audits, in order

1. **Layer placement.** Every file sits where its rule says
   (`cli/CLAUDE.md` table + `.claude/rules/*`). Anything hard to file is
   two things wearing one name — split it, never widen a definition.

2. **Service caller graph** (`services.md`, "earn their place"):
   ```bash
   for f in src/services/*-service.ts; do n=$(basename $f);
     grep -rln "services/$n" src --include="*.ts" | grep -v "$f$"; done
   ```
   A service whose sole caller is an **orchestrator** is the
   build/display split working. A service whose sole caller is
   **another service** folds into it as a private helper — unless it
   has its own test AND names a domain concept, or owns a boundary its
   caller shouldn't absorb.

3. **Hidden model/store methods.** Enumerate module-private functions
   (`grep -n "^function " src/services/*.ts src/orchestrators/*.ts`):
   one that reads only a model's fields is a model method; one verb
   against one store's own contents is a store method. Types-only
   record shuffling stays private — plain interfaces have no class to
   join.

4. **Verb vocabulary** (`stores.md` table, `models.md`): every store
   operation that means the same thing says the same thing (`files()`,
   `all()`, `read`, `write<Noun>`, `by<Field>`, `<noun>For`,
   `mint<Noun>`, `has<Fact>`, `prune`; models: `from<Source>`,
   `serialize`). Custom names only for genuinely distinctive
   operations.

5. **Types discipline** (`types.md`): no single-consumer type sitting in
   the global barrel (demote to its module, unexported); every global
   name reads as its family (`Parent`, `ParentOptions`,
   `ParentOptionsValue` — never orphan `Options`/`Value`); domain
   vocabulary names match the specs' vocabulary.

6. **Legibility** (`legibility.md`): nested call expressions
   (`grep -rn "ctx.render([a-z]" src/orchestrators`), nested ternaries
   in disguise, string-encoded-then-split data, loops in loops,
   `Parameters<typeof …>` gymnastics.

7. **Documentation truth.** Grep for staleness: names of deleted
   files/classes/commands in comments and rules
   (`git log --diff-filter=D --name-only` for recent deletions is a
   good source list); doc comments that describe what the code no
   longer does; `.claude/rules/*` examples that reference dead code;
   emitted templates (`src/templates/`) describing old behavior —
   these ship to users.

8. **READMEs and rules coherence.** Each directory README still
   describes what the directory holds; each rules file's examples still
   exist.

## Gate and prove

Full gate from `cli/`: lint, typecheck, prettier check, `vitest run`,
build. Then the demo canary
(`cd demo && npx praxis eval run --reviewer counter` → all hits) — a
consistency sweep must never change reviewer identity. Finish with the
`demo-audit` skill's affected sections when behavior was touched.

Commit with a message that names the violations found and the rule each
one broke — the sweep's history is how the rules stay honest.
