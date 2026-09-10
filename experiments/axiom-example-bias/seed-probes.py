#!/usr/bin/env python3
"""Seeds the matched-pair probes into a scratch demo copy's run ledger.

One synthetic run file, one critique record per probe (axiom_id null =
born raw), ids `probe-run:<seq>` so analyze.py can find them.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RUN_ID = "probe-run"

def main(root: str) -> None:
    with open(os.path.join(HERE, "probes.json")) as fh:
        probes = json.load(fh)["probes"]

    run_record = {
        "kind": "run",
        "run_id": RUN_ID,
        "timestamp": "2026-09-08T00:00:00.000Z",
        "reviewer_name": "probe",
        "reviewer_model": "none",
        "reviewer_hash": "probe000",
        "scope": "files",
        "branch": None,
        "commit_sha": None,
        "baseline": False,
        "cost_usd": None,
        "fail_count": len(probes),
        "cache_misses": len(probes),
        "cache_hits": 0,
    }

    lines = [json.dumps(run_record)]

    for probe in probes:
        spec = "tests/README.md" if probe["filePath"].startswith("tests/") else "src/services/README.md"
        lines.append(
            json.dumps(
                {
                    "kind": "critique",
                    "id": f"{RUN_ID}:{probe['seq']}",
                    "run_id": RUN_ID,
                    "timestamp": "2026-09-08T00:00:00.000Z",
                    "file_path": probe["filePath"],
                    "spec_path": spec,
                    "severity": "error",
                    "text": probe["text"],
                    "reviewer_name": "probe",
                    "axiom_id": None,
                    "axiom_version": None,
                }
            )
        )

    runs_dir = os.path.join(root, ".praxis", "ledger", "runs")
    os.makedirs(runs_dir, exist_ok=True)

    with open(os.path.join(runs_dir, f"{RUN_ID}.jsonl"), "w") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"  seeded {len(probes)} probes into {root}")

if __name__ == "__main__":
    main(sys.argv[1])
