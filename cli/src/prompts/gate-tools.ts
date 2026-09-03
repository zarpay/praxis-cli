/**
 * Tool definition for the authoring gate (03): one assessment,
 * structured, with the judgment half redrafted when the candidate
 * splits.
 */
export default function gateTools() {
  return [
    {
      type: "function",
      function: {
        name: "authoring_gate",
        description: "Your assessment of the candidate axiom's appropriateness for Praxis.",
        parameters: {
          type: "object",
          properties: {
            assessment: {
              type: "string",
              enum: ["appropriate", "not_appropriate", "split"],
            },
            reasoning: {
              type: "string",
              description:
                "Which litmus test decided it, in one or two sentences a ratifier can check.",
            },
            judgment_half: {
              type: ["string", "null"],
              description:
                "For split: the judgment half alone, redrafted as an admissible statement. Otherwise null.",
            },
          },
          required: ["assessment", "reasoning", "judgment_half"],
        },
      },
    },
  ] as const;
}
