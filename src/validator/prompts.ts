/**
 * System prompt for the LLM document validator.
 *
 * The actual validation criteria come from the spec file in each directory.
 * This prompt provides the framing for the LLM to act as a compliance checker.
 */
export const SYSTEM_PROMPT = `You are a compliance validator.

Your job is to evaluate whether a file satisfies the criteria defined in the provided specification.

## How to Validate

1. Read the specification carefully — it defines what valid files look like in this context
2. Check the file against each criterion the specification establishes
3. Be thorough but fair

Call the appropriate validation tool with your assessment. When reporting issues, reference the specific criterion being violated and what the file must do to satisfy it.`;

/**
 * Tool definitions for structured validation output.
 *
 * The model must call exactly one of these tools to report its assessment.
 * Using tool calls instead of text parsing eliminates fragile regex extraction
 * and guarantees structured, typed results.
 */
export const VALIDATION_TOOLS = [
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
            items: { type: "string" },
            description:
              "Each deviation from the specification. Reference the specific criterion being missed and what would satisfy it.",
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
            items: { type: "string" },
            description:
              "Each violation of the specification. Reference the specific criterion being violated and what the file must do to satisfy it.",
          },
        },
        required: ["reason", "issues"],
      },
    },
  },
] as const;
