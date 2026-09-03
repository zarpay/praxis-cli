/**
 * Tool definition for triage organization (04).
 *
 * One tool, one call: the curator's entire organization arrives as a
 * single structured payload the session then walks cluster by cluster.
 * The descriptions are prompt text: they carry the grounded-theory
 * discipline into the schema itself.
 */
export default function triageTools() {
  return [
    {
      type: "function",
      function: {
        name: "triage_organization",
        description:
          "Your organization of the unassigned critiques: clusters, each with exactly one suggestion. Every critique id appears in exactly one cluster.",
        parameters: {
          type: "object",
          properties: {
            clusters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  critique_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "The critiques in this cluster, by their ids.",
                  },
                  rationale: {
                    type: "string",
                    description: "One sentence: what shared standard makes these one cluster.",
                  },
                  suggestion: {
                    type: "string",
                    enum: ["assign", "propose", "unassignable"],
                  },
                  axiom_id: {
                    type: ["string", "null"],
                    description: "For assign: the established axiom's id. Otherwise null.",
                  },
                  draft: {
                    type: ["object", "null"],
                    description: "For propose: the drafted axiom. Otherwise null.",
                    properties: {
                      statement: {
                        type: "string",
                        description:
                          "One to three sentences asserting the standard — judgment, not mechanics.",
                      },
                      severity: { type: "string", enum: ["error", "warning"] },
                      scope: {
                        type: "string",
                        enum: ["file", "file+context"],
                        description:
                          "What a reviewer must read to decide it. file unless the critiques clearly need declared context.",
                      },
                      violating_example: { type: "string" },
                      compliant_example: { type: "string" },
                      grounding_hint: {
                        type: "string",
                        description:
                          "The specification passage that grounds this standard, quoted verbatim.",
                      },
                    },
                    required: [
                      "statement",
                      "severity",
                      "scope",
                      "violating_example",
                      "compliant_example",
                      "grounding_hint",
                    ],
                  },
                  why_unassignable: {
                    type: ["string", "null"],
                    description:
                      "For unassignable: why this cluster cannot be grounded in the specification.",
                  },
                },
                required: ["critique_ids", "rationale", "suggestion"],
              },
            },
          },
          required: ["clusters"],
        },
      },
    },
  ] as const;
}
