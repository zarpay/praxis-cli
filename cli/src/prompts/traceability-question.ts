/**
 * Ratification's traceability question (04): which spec criterion
 * grounds this proposal? The answer aids the ratifier — traceable,
 * fix-the-spec, or reviewer-invention are the three human outcomes,
 * and this assessment is evidence for that call, never the call.
 */
export default function traceabilityQuestion({
  specPath,
  specContent,
  statement,
}: {
  specPath: string;
  specContent: string;
  statement: string;
}): string {
  return `## THE SPECIFICATION (${specPath})

\`\`\`
${specContent}
\`\`\`

## THE PROPOSED AXIOM

${statement}

## YOUR TASK

Answer: which criterion in this specification grounds the proposed axiom?

- If a passage states or clearly implies the standard: **traceable**. Give the grounding as \`${"${spec path}#${section}"}\` using the nearest heading, and quote the passage verbatim.
- If no passage supports it but the standard seems real: **not traceable**. The honest response to a real-but-untraceable standard is to extend the specification first — say what is missing. If the standard is true across many specifications (a universal value like plainness or simplicity), say so: it belongs stated once in a conventions-grade specification covering everything it governs, and the axiom grounds there — never stretched into a partial grounding here.
- If no passage supports it and the standard looks invented by a reviewer: **not traceable**, and say so plainly — rejected proposals feed the reviewer-noise signal.

Never stretch a passage to cover a standard it does not state. A generous reading here corrupts every rate computed under the axiom later.`;
}
