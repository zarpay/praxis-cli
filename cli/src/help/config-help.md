The project configuration lives at .praxis/config.json, found by
walking up from cwd to the nearest .praxis/ directory. Key fields:
version (the praxis version this project pins), sources (the
directories scanned for specs — a full `eval run` reviews only what
the specs found there govern), reviewers, curator, ignore,
specFilePattern, and the spec-layer fields (expertsDir, practicesDir,
agentProfilesOutputDir, plugins).

The version pin is enforced on every command: a config without one
adopts the running CLI's version (with a warning — commit the change);
a conflicting pin exits 2 and names both ways out — install the pinned
version (npm install -g @zarpay/praxis-cli@<pinned>) or update the pin.

A reviewer is a named model configuration — every reviewer reviews
every target, and results are never pooled:
  { "name": "flash", "model": "deepseek/deepseek-v4-flash-0731",
    "apiKeyEnvVar": "OPENROUTER_API_KEY" }

The curator (required by `axioms triage` and `curate`; worth a
frontier model — it does the taxonomy's thinking) has the same shape
without "name":
  "curator": { "model": "anthropic/claude-sonnet-4.5",
               "apiKeyEnvVar": "OPENROUTER_API_KEY" }

Docs: https://zarpay.github.io/praxis-cli/reference/config
