import { describe, expect, it } from "vitest";

import { PraxisError, errors } from "@/core/errors.js";

describe("errors", () => {
  it("missingFrontmatterField", () => {
    const err = errors.missingFrontmatterField("alias", "experts/broken.md");

    expect(err.code).toBe("MISSING_FRONTMATTER_FIELD");
    expect(err.message).toContain(
      'experts/broken.md is missing required frontmatter field "alias"',
    );
  });

  it("invalidFrontmatterField", () => {
    const err = errors.invalidFrontmatterField("cohort", "src/README.md", '"by_file"', "by_magic");

    expect(err.code).toBe("INVALID_FRONTMATTER_FIELD");
    expect(err.message).toContain('Invalid "cohort" in src/README.md');
    expect(err.message).toContain('expected "by_file", got "by_magic"');
  });

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

  it("duplicateReviewerName", () => {
    const err = errors.duplicateReviewerName("flash");
    expect(err.code).toBe("INVALID_REVIEWER_CONFIG");
    expect(err.message).toBe(
      'Duplicate reviewer name "flash" in .praxis/config.json — reviewer names must be unique',
    );
  });

  it("reviewerMissingField", () => {
    const err = errors.reviewerMissingField("flash", "apiKeyEnvVar");
    expect(err.code).toBe("INVALID_REVIEWER_CONFIG");
    expect(err.message).toBe(
      'Reviewer "flash" is missing "apiKeyEnvVar" — every reviewer needs "name", "model", and "apiKeyEnvVar"',
    );
  });

  it("unknownReviewer", () => {
    const err = errors.unknownReviewer("bogus", ["flash", "local"]);
    expect(err.code).toBe("UNKNOWN_REVIEWER");
    expect(err.message).toBe('No reviewer named "bogus" — configured reviewers: flash, local');
  });

  it("missingReviewers", () => {
    const err = errors.missingReviewers();
    expect(err.code).toBe("REVIEWERS_NOT_CONFIGURED");
    expect(err.message).toContain('"reviewers": [');
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

  it("apiKeyNotSet", () => {
    const err = errors.apiKeyNotSet("OPENROUTER_API_KEY");
    expect(err.code).toBe("API_KEY_NOT_SET");
    expect(err.message).toBe("OPENROUTER_API_KEY environment variable not set");
  });

  it("reviewerApiError", () => {
    const err = errors.reviewerApiError("openrouter", 502, "upstream unavailable");
    expect(err.code).toBe("REVIEWER_API_ERROR");
    expect(err.message).toBe(
      'Reviewer provider "openrouter" API error (502): upstream unavailable',
    );
  });

  it("unknownReviewProvider", () => {
    const err = errors.unknownReviewProvider("bogus", ["openrouter"]);
    expect(err.code).toBe("UNKNOWN_REVIEW_PROVIDER");
    expect(err.message).toBe(
      'Unknown reviewer provider: "bogus". Built-in providers: openrouter. ' +
        "A custom provider must be a ./relative module path.",
    );
  });

  it("reviewProviderLoadFailed", () => {
    const err = errors.reviewProviderLoadFailed("./providers/echo.js", "Cannot find module");
    expect(err.code).toBe("REVIEW_PROVIDER_LOAD_FAILED");
    expect(err.message).toBe(
      'Failed to load reviewer provider "./providers/echo.js": Cannot find module',
    );
  });

  it("invalidReviewProvider", () => {
    const err = errors.invalidReviewProvider(
      "./providers/echo.js",
      "default export is not a function",
    );
    expect(err.code).toBe("INVALID_REVIEW_PROVIDER");
    expect(err.message).toBe(
      'Invalid reviewer provider "./providers/echo.js": default export is not a function — ' +
        "a provider module's default export must be a factory returning { name, review() }",
    );
  });

  it("reviewProviderFailed", () => {
    const err = errors.reviewProviderFailed("echo", "socket hang up");
    expect(err.code).toBe("REVIEW_PROVIDER_FAILED");
    expect(err.message).toBe('Reviewer provider "echo" failed: socket hang up');
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
