/**
 * Tool definition for the ratification traceability assessment (04).
 */
export default function traceabilityTools() {
  return [
    {
      type: "function",
      function: {
        name: "spec_traceability",
        description: "Whether — and where — the specification grounds the proposed axiom.",
        parameters: {
          type: "object",
          properties: {
            traceable: { type: "boolean" },
            grounding: {
              type: ["string", "null"],
              description:
                'When traceable: "<spec path>#<nearest section heading, kebab-case>". Otherwise null.',
            },
            quoted_basis: {
              type: "string",
              description:
                "When traceable: the grounding passage, quoted verbatim. Otherwise what is missing from the spec.",
            },
            reasoning: { type: "string" },
          },
          required: ["traceable", "grounding", "quoted_basis", "reasoning"],
        },
      },
    },
  ] as const;
}
