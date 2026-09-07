/**
 * Tool definition for the labeling pass (04): the curator must return
 * one entry per pending critique — an axiom id when squarely an
 * instance, null otherwise. Structured output, no text parsing.
 */
export default function labelingTools() {
  return [
    {
      type: "function",
      function: {
        name: "label_critiques",
        description:
          "Your labels, one entry per pending critique, in the order given. axiom_id is the id of the axiom the critique is squarely an instance of, or null when it is not squarely an instance of exactly one axiom.",
        parameters: {
          type: "object",
          properties: {
            labels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  critique_id: { type: "string" },
                  axiom_id: { type: ["string", "null"] },
                },
                required: ["critique_id", "axiom_id"],
              },
            },
          },
          required: ["labels"],
        },
      },
    },
  ] as const;
}
