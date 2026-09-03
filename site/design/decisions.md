# Design Decisions

## Conceptual linting as a practice

Code teams lint syntax. They lint types. They run formatters. The idea that automated tooling should enforce code conventions is completely uncontroversial.

The same idea has not reached the documents that live alongside that code. Architecture decision records drift from their agreed format. Service object conventions get ignored because nothing catches violations. Agent expert definitions grow stale because the conventions they reference were updated in March and nobody remembered to update the expert.

These aren't syntax violations — no static analyzer can catch them. They're **conceptual violations**: documents that fail to meet the structural, architectural, or content standards the team actually agreed on.

Praxis is the tool for conceptual linting. Write the standard in a README. Run `praxis eval run`. Block the merge. The same rigor you apply to code, applied to any organized body of documents.

The compilation capability — turning knowledge documents into agent profiles — is built on top of this foundation. Linting is what keeps the source knowledge honest. Compilation is what turns trusted knowledge into deployable SME agents.

---

## Plain markdown, not a proprietary format

Praxis input and output are both standard markdown. There is no custom AST, no special syntax, no binary format.

This means:

- You can read and edit any Praxis file in any editor
- Compiled profiles can be pasted directly into any LLM interface
- The entire knowledge base is legible to humans without running the CLI
- Diffs are meaningful in code review

The tradeoff is that frontmatter YAML has to carry the manifest, which is slightly more verbose than a purpose-built format. That cost is worth the interoperability.

## Compilation as a first-class step

Praxis requires an explicit compile step rather than dynamically resolving references at agent invocation time.

The reasons:

- **The output is reviewable.** You can read `agent-profiles/reviewer.md` and verify that it contains what you expect before it reaches a production agent.
- **The output is static.** A compiled profile doesn't have runtime dependencies. You don't need to run Praxis in your agent infrastructure.
- **Compile-time errors are caught early.** Missing references fail at compile time, not silently at runtime.

The tradeoff is that you must recompile after any content change. The `--watch` flag makes this automatic during authoring.

## READMEs as specs

The same file that documents a directory's purpose also defines the validation criteria for that directory. This is a deliberate choice, not a limitation.

One file means:

- Specs are always where you expect them
- Documentation and enforcement are synchronized — they can't drift from each other
- There is no separate "spec format" to learn

The tradeoff is that the README must serve two audiences — human readers and the LLM validator. In practice, writing clearly for humans also works well for LLMs. If you prefer to separate them, use `specFilePattern: "SPEC.md"` in config to point at a dedicated spec file instead.

## LLM review, not schema validation — and the judgment boundary

Praxis uses LLM reviewers, not a schema validator. Schema validators can check field presence and type; they cannot check whether an error message would help the consumer who hit it, whether a service really does one thing, or whether an ADR's "Consequences" section is genuinely thoughtful.

The boundary is enforced in both directions. Reviewers are explicitly told that mechanical criteria — anything a linter, regex, or type check could decide — are out of scope and must not be reported, *even where the spec states them*. A reviewer that is never asked mechanical questions cannot answer them wrongly, which removes the surface hallucinations grow on; and a team is never tempted to pay LLM prices for what a regex does free. The same rule gates the axiom taxonomy: a proposal a linter could enforce is refused at authoring. *If you can write the check, write the check.*

The remaining tradeoffs — an API key, per-call cost, non-determinism at the margin — are handled structurally: the content-hash cache makes unchanged targets free, multiple reviewers make disagreement visible instead of hidden, and every report carries its calibration status rather than pretending the instrument is precise.

## Evidence over amnesia

Most review tooling reports and forgets. Praxis appends every run to a committed ledger — run records with commit, cost, and counts; critique records with full provenance — because the questions that matter later ("when did this start", "did that spec change help", "what did this cost") can only be answered by evidence kept at the time. The cache answers *is this compliant now*; the ledger answers *what has ever happened*. Reports (`eval report`, `debt report`) are pure reads over it: never a reviewer call, rates always with denominators, reviewers never pooled, and nothing charted across an epoch boundary.

## LLM proposes, human ratifies

Every step that shapes the taxonomy — clustering critiques, drafting axioms, assessing traceability — is done by the curator model and **decided by a human**. Nothing enters the checklist without ratification against the spec's own text, and every decision (including `--yes` bulk-accepts) is recorded as what it was. The reviewers' job is to see; the curator's job is to organize; naming what your team's standards *are* stays yours.

## One output file per expert

Each expert compiles to one standalone file. There is no "shared context" that is loaded at runtime — everything is inlined.

This simplifies deployment:

- The file is self-contained
- No runtime dependency on Praxis or the source documents
- No file system access required at agent invocation time

The tradeoff is file size — an expert with many shared constitution docs will have a larger compiled profile. In practice, agent context windows are large enough that this is not a problem.

## No agent framework SDK

Praxis produces markdown. It does not have a runtime SDK, an agent execution library, or an API client.

This was deliberate. The problem Praxis solves is _authoring and maintaining structured knowledge_ — not _running agents_. Coupling the knowledge compiler to a runtime would narrow what you can use the output for.

Use the compiled profiles with any platform: Claude Code, the Anthropic API, OpenAI, Gemini, a custom RAG system, or a document in a wiki.

## See also

- [Knowledge Primitives](/concepts/knowledge-primitives)
- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Review Domains](/concepts/validation-domains)
