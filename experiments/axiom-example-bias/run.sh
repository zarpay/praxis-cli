#!/usr/bin/env bash
# Axiom-example-bias experiment: two scratch copies of the demo, one
# with axiom examples stripped, real `praxis axioms triage` in each.
# Reads the real demo; writes only under this directory.
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "OPENROUTER_API_KEY is not set — source ~/.secrets first." >&2
  exit 2
fi

DEMO=../../demo
WORK=work

rm -rf "$WORK" results
mkdir -p "$WORK" results

for COND in A B; do
  echo "── preparing condition $COND"
  cp -r "$DEMO" "$WORK/$COND"
  # Every born-raw critique becomes untriaged again; axiom *files* keep
  # their statuses (deprecation lives in the file, not the record).
  rm -rf "$WORK/$COND/.praxis/ledger/triage"
  python3 seed-probes.py "$WORK/$COND"
done

echo "── condition B: stripping axiom bodies to statements"
python3 strip-examples.py "$WORK/B"

for COND in A B; do
  echo "── triage, condition $COND"
  (cd "$WORK/$COND" && NO_COLOR=1 praxis axioms triage) | tee "results/$COND.out"
done

echo "── done. Next: python3 analyze.py"
