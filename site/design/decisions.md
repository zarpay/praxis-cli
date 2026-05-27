# Design Decisions

## Conceptual linting as a practice

Code teams lint syntax. They lint types. They run formatters. The idea that automated tooling should enforce code conventions is completely uncontroversial.

The same idea has not reached the documents that live alongside that code. Architecture decision records drift from their agreed format. Service object conventions get ignored because nothing catches violations. Agent role definitions grow stale because the conventions they reference were updated in March and nobody remembered to update the role.

These aren't syntax violations — no static analyzer can catch them. They're **conceptual violations**: documents that fail to meet the structural, architectural, or content standards the team actually agreed on.

Praxis is the tool for conceptual linting. Write the standard in a README. Run `praxis validate`. Block the merge. The same rigor you apply to code, applied to any organized body of documents.

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

## LLM validation, not schema validation

Praxis uses an LLM to validate documents against specs, not a schema validator or linter.

Schema validators can check field presence and type. They cannot check whether a `description` field is actually descriptive, whether a `## Scope` section actually explains the agent's scope, whether an ADR's "Consequences" section is genuinely thoughtful, or whether a service object's header comment explains when to use it.

The LLM reads your spec as instructions and exercises judgment — the same kind of judgment a senior developer would use in a review.

The tradeoff is that LLM validation requires an API key, costs money per call, and is non-deterministic at the margin. The content hash cache mitigates the cost by only calling the API when content changes. The non-determinism is acceptable for documentation quality checks.

## One output file per role

Each role compiles to one standalone file. There is no "shared context" that is loaded at runtime — everything is inlined.

This simplifies deployment:
- The file is self-contained
- No runtime dependency on Praxis or the source documents
- No file system access required at agent invocation time

The tradeoff is file size — a role with many shared constitution docs will have a larger compiled profile. In practice, agent context windows are large enough that this is not a problem.

## No agent framework SDK

Praxis produces markdown. It does not have a runtime SDK, an agent execution library, or an API client.

This was deliberate. The problem Praxis solves is *authoring and maintaining structured knowledge* — not *running agents*. Coupling the knowledge compiler to a runtime would narrow what you can use the output for.

Use the compiled profiles with any platform: Claude Code, the Anthropic API, OpenAI, Gemini, a custom RAG system, or a document in a wiki.

## See also

- [Knowledge Primitives](/concepts/knowledge-primitives)
- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Validation Domains](/concepts/validation-domains)
