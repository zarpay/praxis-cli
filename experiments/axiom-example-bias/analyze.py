#!/usr/bin/env python3
"""Scores both conditions against human ground truth and the probes.

Truth, part 1 (real critiques): from the REAL demo ledger — the latest
human decision per critique. Assignments with decision human/flag:--yes/
merge count as "should label X"; dismissals count as "should match
nothing". Matcher-made labels are excluded (instrument under test).
Only critiques the scratch runs actually considered are scored.

Truth, part 2 (probes): probes.json.

Labels per condition: read from the scratch copies' triage ledgers —
matcher assignments = labeled, unmatched records = no match.
"""

import glob
import json
import os
import re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(HERE, "..", "..", "demo")
HUMAN_DECISIONS = {"human", "flag:--yes", "merge"}

def records(pattern: str):
    for path in sorted(glob.glob(pattern)):
        with open(path) as fh:
            for line in fh:
                if line.strip():
                    yield json.loads(line)

def human_truth() -> dict:
    """critique_id -> axiom_id | None (dismissed), latest human record wins."""
    truth = {}

    for record in records(os.path.join(DEMO, ".praxis", "ledger", "triage", "*.jsonl")):
        if record["kind"] == "assignment":
            if record["assigned_by"]["decision"] in HUMAN_DECISIONS:
                truth[record["critique_id"]] = record["axiom_id"]
            else:
                truth.pop(record["critique_id"], None)  # matcher label supersedes: unknown truth

        if record["kind"] == "dismissal":
            truth[record["critique_id"]] = None

    return truth

def condition_labels(cond: str) -> dict:
    """critique_id -> axiom_id | None (unmatched), from the scratch ledger."""
    labels = {}

    for record in records(os.path.join(HERE, "work", cond, ".praxis", "ledger", "triage", "*.jsonl")):
        if record["kind"] == "assignment":
            labels[record["critique_id"]] = record["axiom_id"]

        if record["kind"] == "unmatched":
            labels[record["critique_id"]] = None

    return labels

def score(truth: dict, labels: dict) -> dict:
    ids = [cid for cid in truth if cid in labels]
    cells = Counter()
    deltas = []

    for cid in ids:
        want, got = truth[cid], labels[cid]

        if want is None:
            cells["true-negative" if got is None else "false-label"] += 1
        elif got == want:
            cells["exact-match"] += 1
        elif got is None:
            cells["missed"] += 1
        else:
            cells["wrong-axiom"] += 1

        if (want or got) and want != got:
            deltas.append((cid, want, got))

    return {"n": len(ids), "cells": dict(cells), "deltas": deltas}

def active_axioms() -> set:
    """Ids of axioms the labeler could actually offer — active in the scratch copies."""
    ids = set()

    for path in glob.glob(os.path.join(HERE, "work", "A", ".praxis", "axioms", "*.md")):
        content = open(path).read()

        if "\nstatus: active\n" in content:
            match = re.search(r"^id: (AX-[0-9a-f]{6})$", content, re.M)

            if match:
                ids.add(match.group(1))

    return ids

def main() -> None:
    labelable = active_axioms()
    truth = {
        cid: axiom
        for cid, axiom in human_truth().items()
        if axiom is None or axiom in labelable
    }
    with open(os.path.join(HERE, "probes.json")) as fh:
        probe_truth = {f"probe-run:{p['seq']}": p for p in json.load(fh)["probes"]}

    a, b = condition_labels("A"), condition_labels("B")

    lines = ["# Results — axiom-example bias\n"]

    lines.append("## Part 1 — human ground truth (real critiques)\n")
    for name, labels in (("A (examples)", a), ("B (statement-only)", b)):
        s = score(truth, labels)
        lines.append(f"**{name}** — n={s['n']}: {s['cells']}")
        for cid, want, got in s["deltas"]:
            lines.append(f"  - {cid}: truth={want} got={got}")
        lines.append("")

    lines.append("## Part 2 — matched-pair probes\n")
    lines.append("| # | axiom | kind | truth | A (examples) | B (statement-only) |")
    lines.append("|---|-------|------|-------|---|---|")
    bias = {"A": Counter(), "B": Counter()}

    for cid, probe in sorted(probe_truth.items(), key=lambda kv: kv[1]["seq"]):
        got_a, got_b = a.get(cid, "∅"), b.get(cid, "∅")
        lines.append(
            f"| {probe['seq']} | {probe['axiom']} | {probe['kind']} | {probe['truth']} | {got_a} | {got_b} |"
        )

        for cond, got in (("A", got_a), ("B", got_b)):
            if probe["kind"] == "true-far" and got != probe["truth"]:
                bias[cond]["missed true-far"] += 1

            if probe["kind"] == "false-near" and got not in (None, "∅"):
                bias[cond]["labeled false-near"] += 1

    lines.append("")
    lines.append("**Bias signature** (examples-bias predicts A > B on both):")
    for cond in ("A", "B"):
        lines.append(f"- {cond}: {dict(bias[cond]) or 'clean'}")

    report = "\n".join(lines) + "\n"
    out = os.path.join(HERE, "results", "report.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    with open(out, "w") as fh:
        fh.write(report)

    print(report)
    print(f"written to {out}")

if __name__ == "__main__":
    main()
