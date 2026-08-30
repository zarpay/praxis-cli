import { describe, expect, it } from "vitest";

import { PraxisError, errors } from "@/core/errors.js";

describe("errors", () => {
  it("factories produce PraxisError instances that are also Errors", () => {
    const err = errors.rootNotFound();
    expect(err).toBeInstanceOf(PraxisError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PraxisError");
  });

  it("rootNotFound", () => {
    const err = errors.rootNotFound();
    expect(err.code).toBe("ROOT_NOT_FOUND");
    expect(err.message).toBe("Could not find Praxis root (no .praxis/ directory found)");
  });

  it("invalidConfigJson", () => {
    const err = errors.invalidConfigJson("/p/.praxis/config.json", "Unexpected token");
    expect(err.code).toBe("INVALID_CONFIG_JSON");
    expect(err.message).toBe("Invalid JSON in /p/.praxis/config.json: Unexpected token");
  });

  it("unknownPlugin", () => {
    const err = errors.unknownPlugin("bogus", ["claude-code", "other"]);
    expect(err.code).toBe("UNKNOWN_PLUGIN");
    expect(err.message).toBe('Unknown plugin: "bogus". Available plugins: claude-code, other');
  });

  it("fileAlreadyExists", () => {
    const err = errors.fileAlreadyExists("roles/dup.md");
    expect(err.code).toBe("FILE_ALREADY_EXISTS");
    expect(err.message).toBe("File already exists: roles/dup.md");
  });

  it("templateNotFound", () => {
    const err = errors.templateNotFound("/scaffold/core/roles/_template.md");
    expect(err.code).toBe("TEMPLATE_NOT_FOUND");
    expect(err.message).toBe("Template not found: /scaffold/core/roles/_template.md");
  });

  it("invalidCohortValue", () => {
    const err = errors.invalidCohortValue("by_magic", "docs/services.sme.md");
    expect(err.code).toBe("INVALID_COHORT");
    expect(err.message).toBe(
      'Invalid cohort value "by_magic" in docs/services.sme.md — expected "by_file" or "by_directory"',
    );
  });

  it("unknownDocumentType", () => {
    const err = errors.unknownDocumentType("bogus");
    expect(err.code).toBe("UNKNOWN_DOCUMENT_TYPE");
    expect(err.message).toBe("Unknown document type: bogus");
  });

  it("specNotFound", () => {
    const err = errors.specNotFound("SPEC.md", "/p/roles", "/p/roles/doc.md");
    expect(err.code).toBe("SPEC_NOT_FOUND");
    expect(err.message).toBe("No SPEC.md found in /p/roles for /p/roles/doc.md");
  });

  it("specPatternNotFound", () => {
    const err = errors.specPatternNotFound("*.sme.md", "/p/roles", "/p/roles/doc.md");
    expect(err.code).toBe("SPEC_NOT_FOUND");
    expect(err.message).toBe("No file matching '*.sme.md' found in /p/roles for /p/roles/doc.md");
  });

  it("validationNotConfigured", () => {
    const err = errors.validationNotConfigured("model");
    expect(err.code).toBe("VALIDATION_NOT_CONFIGURED");
    expect(err.message).toBe(
      "Validation requires 'model' to be configured. " +
        "Add a 'validation' section to .praxis/config.json with 'apiKeyEnvVar' and 'model'.",
    );
  });

  it("apiKeyNotSet", () => {
    const err = errors.apiKeyNotSet("OPENROUTER_API_KEY");
    expect(err.code).toBe("API_KEY_NOT_SET");
    expect(err.message).toBe("OPENROUTER_API_KEY environment variable not set");
  });

  it("openRouterApiError", () => {
    const err = errors.openRouterApiError(502, "upstream unavailable");
    expect(err.code).toBe("OPENROUTER_API_ERROR");
    expect(err.message).toBe("OpenRouter API error (502): upstream unavailable");
  });

  it("noToolCall", () => {
    const err = errors.noToolCall();
    expect(err.code).toBe("NO_TOOL_CALL");
    expect(err.message).toBe(
      "Model did not return a tool call. Ensure the configured model supports tool calling.",
    );
  });

  it("unexpectedToolCall", () => {
    const err = errors.unexpectedToolCall("validation_bogus");
    expect(err.code).toBe("UNEXPECTED_TOOL_CALL");
    expect(err.message).toBe("Unexpected validation tool call: validation_bogus");
  });
});
