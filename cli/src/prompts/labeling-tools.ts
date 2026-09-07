/**
 * Tool definition for the labeling pass: one critique per call,
 * one verdict back — the axiom id the critique is squarely an instance
 * of, or null. Structured output, no text parsing.
 */
export default function labelingTools() {
  return [
    {
      type: "function",
      function: {
        name: "label_critique",
        description:
          "Your verdict for the pending critique. axiom_id is the id of the axiom the critique is squarely an instance of, or null when it is not squarely an instance of exactly one axiom.",
        parameters: {
          type: "object",
          properties: {
            axiom_id: { type: ["string", "null"] },
          },
          required: ["axiom_id"],
        },
      },
    },
  ] as const;
}
