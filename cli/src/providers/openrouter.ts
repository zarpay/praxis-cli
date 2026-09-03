import type {
  ChatCompletionResponse,
  ReviewProvider,
  ProviderCompletion,
  ProviderRequest,
  ProviderResult,
  ProviderUsage,
  ToolCall,
  Verdict,
} from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";

/**
 * The default reviewer provider: OpenAI-compatible chat completions with
 * required tool calling, via OpenRouter or any endpoint speaking the
 * same protocol (per-reviewer `baseUrl`).
 *
 * Request `options` are spread first, so they can add backend fields
 * (e.g. OpenRouter routing or reasoning settings) but never clobber
 * the protocol fields praxis owns: model, messages, tools,
 * tool_choice, temperature.
 */
export class OpenRouterProvider implements ReviewProvider {
  readonly name = "openrouter";

  /**
   * Calls the chat-completions endpoint and normalizes the response.
   *
   * The model must answer with exactly one validation tool call —
   * structured output with no text parsing.
   *
   * @throws PraxisError on non-OK responses, missing tool calls, or a
   *   tool outside the three validation tools
   */
  async review(request: ProviderRequest): Promise<ProviderResult> {
    const response = await fetch(`${request.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request.options,
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        tools: request.tools,
        tool_choice: "required",
        temperature: request.temperature,
        ...(this.supportsUsageAccounting(request.baseUrl) && { usage: { include: true } }),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw errors.reviewerApiError(this.name, response.status, body);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw errors.noToolCall();
    }

    return {
      verdict: this.verdictFromToolCall(toolCall, this.parseArguments(toolCall, data)),
      usage: this.normalizeUsage(data.usage),
    };
  }

  /**
   * One raw structured-output call: same endpoint and protocol as a
   * review, but the tool call comes back unparsed — the curator's
   * prompts (04) own their own shapes.
   *
   * @throws PraxisError on non-OK responses or a missing tool call
   */
  async complete(request: ProviderRequest): Promise<ProviderCompletion> {
    const response = await fetch(`${request.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request.options,
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        tools: request.tools,
        tool_choice: "required",
        temperature: request.temperature,
        ...(this.supportsUsageAccounting(request.baseUrl) && { usage: { include: true } }),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw errors.reviewerApiError(this.name, response.status, body);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw errors.noToolCall();
    }

    return {
      toolName: toolCall.function.name,
      args: this.parseArguments(toolCall, data),
      usage: this.normalizeUsage(data.usage),
    };
  }

  /**
   * Whether to request OpenRouter's usage accounting (`usage.include`),
   * which adds cost to the response. Gated to openrouter.ai hosts:
   * generic OpenAI-compatible endpoints reject unknown body fields.
   */
  private supportsUsageAccounting(baseUrl: string): boolean {
    try {
      return new URL(baseUrl).hostname.endsWith("openrouter.ai");
    } catch {
      return false;
    }
  }

  /** Maps the model's validation tool call to a normalized verdict. */
  private verdictFromToolCall(toolCall: ToolCall, parsedArgs: unknown): Verdict {
    const args = parsedArgs as {
      reason: string;
      issues?: { axiom?: string | null; text?: string }[];
    };
    const { reason, issues = [] } = args;

    // The wire shape is {axiom, text}; the axiom's version and validity
    // against the actual checklist are resolved a layer up, where the
    // checklist lives.
    const critiques = issues.map((issue) => ({
      text: issue.text ?? "",
      axiomId: issue.axiom ?? null,
      axiomVersion: null,
    }));

    switch (toolCall.function.name) {
      case "validation_pass":
        return { compliant: true, issues: [], reason };
      case "validation_warn":
        return { compliant: false, severity: "warning", issues: critiques, reason };
      case "validation_fail":
        return { compliant: false, severity: "error", issues: critiques, reason };
      default:
        throw errors.unexpectedToolCall(toolCall.function.name);
    }
  }

  /**
   * The tool call's arguments, parsed — with an instructive failure.
   *
   * Some backends return truncated or empty argument strings (a
   * completion cut off at max_tokens, or a model quirk); naming the
   * finish_reason and showing the tail turns a bare "unexpected end of
   * JSON" into something a config edit can fix.
   */
  private parseArguments(toolCall: ToolCall, data: ChatCompletionResponse): unknown {
    const raw = toolCall.function.arguments;

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      const finishReason =
        (data.choices[0] as { finish_reason?: string }).finish_reason ?? "unknown";
      const tail = raw.length > 80 ? `…${raw.slice(-80)}` : raw;

      throw errors.reviewerApiError(
        this.name,
        200,
        `tool call arguments are not valid JSON (finish_reason: ${finishReason}, ${raw.length} chars, tail: "${tail}") — if truncated, raise max_tokens in the model's options`,
      );
    }
  }

  /** Normalizes the response usage block; null when the backend reported none. */
  private normalizeUsage(usage: ChatCompletionResponse["usage"]): ProviderUsage | null {
    if (!usage) return null;

    return {
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      costUsd: usage.cost ?? null,
    };
  }
}
