Praxis holds the standards your linter can't: a spec is a README that
states what correct looks like for the files it governs, and `praxis
eval run` has LLM reviewers read each governed file against it —
asking not "does it work" but "does it match what you said correct
looks like". Verdicts are cached by content hash (unchanged content is
free), every run appends evidence to a committed ledger, and recurring
critiques become axioms: named, human-accepted categories of recurring
critique with stable ids. Optionally, expert documents compile into
SME agent profiles — the eval loop stands on its own without them.

New project: `praxis init` creates .praxis/config.json and prints the
setup path (write a spec → set the reviewer's key → first run).

Typical flows:
  Get advice while writing:         praxis feedback <target>
  Evaluate work you just changed:   praxis eval run <target> --json
  Understand a violated standard:   praxis axioms show <id>
  Check project health:             praxis status
  Read the accumulated evidence:    praxis eval report

Agents are first-class users of this CLI, and help is the API
documentation: every command's --help states when to use it, how it
behaves, its --json contract, and a link to the full docs. There is no
separate agent surface — this is it.

Behavior:
  Bare `praxis` is the orientation screen: last run, the two queues
  (untriaged / awaiting curation), active axioms, per-reviewer errors —
  each line naming the command that acts on it. With --json it is the
  cheapest situational poll: { lastRun, pendingTriage, awaitingCuration,
  activeAxioms, calibration, debtLine }.

  stdout is data, stderr is commentary: progress and headings go to
  stderr, so piped or captured stdout stays parseable. Every read
  surface takes --json, and each JSON payload is a stable contract.

Exit codes:
  0  success / no violations
  1  violations found, or a run failure
  2  usage or configuration error

Docs: https://zarpay.github.io/praxis-cli/
      https://zarpay.github.io/praxis-cli/getting-started/
