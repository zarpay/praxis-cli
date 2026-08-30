import type { JudgeConfig } from "@/core/config.js";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** A baseline judge for tests that need one and don't care which. */
export const TEST_JUDGE: JudgeConfig = {
  name: "test",
  model: "test-model",
  apiKeyEnvVar: "OPENROUTER_API_KEY",
};

/** The concrete server type setupServer() returns (msw's exported alias has drifted across versions). */
type OpenRouterServer = ReturnType<typeof setupServer>;

/** The OpenRouter chat completions endpoint the validator calls. */
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** The validation tool names the model can call. */
export type ValidationToolName = "validation_pass" | "validation_warn" | "validation_fail";

/**
 * Builds an OpenRouter chat-completion response body containing a single
 * validation tool call, matching the shape Judge parses.
 *
 * @param toolName - Which validation tool the "model" called
 * @param args - The tool arguments (reason, and issues for warn/fail)
 */
export function validationToolCallResponse(
  toolName: ValidationToolName,
  args: { reason: string; issues?: string[] },
): object {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `call_${toolName}`,
              type: "function",
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}

/**
 * Registers an MSW handler that answers every OpenRouter request
 * with the given response body.
 *
 * @param server - The test file's MSW server instance
 * @param body - Response body (typically from validationToolCallResponse)
 * @param status - HTTP status code (default 200)
 */
export function useOpenRouterResponse(server: OpenRouterServer, body: object, status = 200): void {
  server.use(http.post(OPENROUTER_URL, () => HttpResponse.json(body, { status })));
}

/**
 * Creates an MSW server for OpenRouter interception.
 *
 * The caller is responsible for the listen/reset/close lifecycle
 * (beforeAll/afterEach/afterAll), keeping test-runner hooks visible
 * in the test file itself.
 */
export function createOpenRouterServer(): OpenRouterServer {
  return setupServer();
}
