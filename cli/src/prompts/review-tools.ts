/**
 * Tool definitions for structured validation output.
 *
 * The model must call exactly one of these tools to report its
 * assessment. Using tool calls instead of text parsing eliminates
 * fragile regex extraction and guarantees structured, typed results.
 * The descriptions are prompt text: they draw the pass/warn/fail
 * boundary AND teach the channel decision (04), so they are part of
 * the reviewer's behavioral surface.
 */
export default function reviewTools() {
  const issueItems = {
    type: "object",
    properties: {
      axiom: {
        type: ["string", "null"],
        description:
          'The AXIOM CHECKLIST id (e.g. "AX-3f9c2d") this violation is squarely an instance of. Cite an id ONLY when the violation is exactly what that axiom states. For any violation the checklist does not cover — or when no checklist is present — use null: an uncovered violation is valuable evidence, never noise.',
      },
      text: {
        type: "string",
        description:
          "The violation: the specific criterion violated, where, and what the file must do to satisfy it.",
      },
    },
    required: ["axiom", "text"],
  } as const;

  return [
    {
      type: "function",
      function: {
        name: "validation_pass",
        description:
          "The file satisfies all criteria defined in the specification. Call this when the file conforms to every requirement the spec establishes — nothing required is missing and no violations are present.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Concise explanation of why the file satisfies the specification.",
            },
          },
          required: ["reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "validation_warn",
        description:
          "The file satisfies the core requirements of the specification but deviates in ways that are non-critical — optional criteria unmet, stylistic inconsistencies, or minor gaps that do not break the intended pattern. Call this when the file is usable but improvement is expected.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Overall summary of how the file relates to the specification.",
            },
            issues: {
              type: "array",
              items: issueItems,
              description:
                "Each deviation from the specification, tagged with the checklist axiom it violates, or null for open-channel deviations.",
            },
          },
          required: ["reason", "issues"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "validation_fail",
        description:
          "The file violates one or more required criteria in the specification. Call this when required elements are absent, patterns the spec mandates are broken, or the file fundamentally does not conform to what the spec defines as valid.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Overall summary of how the file fails to meet the specification.",
            },
            issues: {
              type: "array",
              items: issueItems,
              description:
                "Each violation of the specification, tagged with the checklist axiom it violates, or null for open-channel violations.",
            },
          },
          required: ["reason", "issues"],
        },
      },
    },
  ] as const;
}
