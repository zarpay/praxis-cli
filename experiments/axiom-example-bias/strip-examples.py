#!/usr/bin/env python3
"""Condition B: truncate every axiom body to its statement.

The statement is the body text before the first `## ` section heading —
the same rule as AxiomFile.statement(). Frontmatter untouched.
"""

import glob
import os
import sys

def main(root: str) -> None:
    stripped = 0

    for path in glob.glob(os.path.join(root, ".praxis", "axioms", "**", "*.md"), recursive=True):
        with open(path) as fh:
            content = fh.read()

        # Split frontmatter from body.
        assert content.startswith("---\n"), path
        end = content.index("\n---\n", 4) + len("\n---\n")
        frontmatter, body = content[:end], content[end:]

        heading = body.find("\n## ")
        statement = body if heading == -1 else body[:heading]

        with open(path, "w") as fh:
            fh.write(frontmatter + statement.rstrip() + "\n")

        stripped += 1

    print(f"  stripped examples from {stripped} axiom file(s) in {root}")

if __name__ == "__main__":
    main(sys.argv[1])
