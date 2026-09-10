# Experiment: do axiom examples bias the labeler?

**Theory (owner, 2026-09-08):** the violating/compliant examples in an
axiom's body may bias the triage labeler toward the code sample's
surface features instead of the axiom's principle — under-matching
critiques that state the principle in unfamiliar code, over-matching
critiques that echo the example's vocabulary while violating nothing
the axiom asserts.

**Where it matters:** after review→label, axiom bodies reach a model in
exactly one place — the triage labeler's prompt. So the decision under
test is *what the labeler sees*, not what the axiom file contains
(examples still serve humans at `axioms show`).

## Design

Two conditions, same critiques, same curator model, temperature 0, one
call per critique (ordering cannot confound):

- **A (examples)** — current behavior: the labeler sees each axiom's
  full body (statement + violating + compliant example).
- **B (statement-only)** — a scratch copy of the demo whose axiom
  bodies are truncated to the statement.

Scored against two truth sets:

1. **Human ground truth** (Part 1): the demo ledger's human-decided
   critiques — curate-accepted assignments, merge re-labels, and
   dismissals (truth: no label). Matcher-made labels are excluded:
   that is the instrument under test. Caveat recorded: `flag:--yes`
   decisions are bulk-accepted curator suggestions, so dismissals and
   merge re-labels are the strongest truth.
2. **Matched-pair probes** (Part 2): 12 hand-written critiques seeded
   into the scratch ledgers, two kinds per axiom for three axioms:
   - *principle-true, surface-far* — violates the principle in code
     nothing like the example (truth: the axiom);
   - *principle-false, surface-near* — echoes the example's vocabulary
     but violates nothing the axiom asserts (truth: no match).
   The bias signature: A misses true-far and false-positives on
   false-near, relative to B. If A ≈ B here, examples are not biasing.

## Run it

```bash
source ~/.secrets        # OPENROUTER_API_KEY
cd experiments/axiom-example-bias
./run.sh                 # ~2 × (real critiques + 12 probes) curator calls; a dollar or two
python3 analyze.py       # writes results/report.md
```

`run.sh` copies `demo/` into `work/` (gitignored), wipes the scratch
copies' triage ledgers so every born-raw critique is untriaged again,
seeds the probes, strips condition B's axiom examples, and runs a real
`praxis axioms triage` in each copy — the labels land as records in the
scratch ledgers, which `analyze.py` reads (no stdout parsing).

The real `demo/` is only ever read. Nothing outside this directory is
written.

## Delete it

```bash
rm -rf experiments/axiom-example-bias
```

That is the whole footprint.
