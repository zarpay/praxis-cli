import type {
  ProviderCompletion,
  ProviderRequest,
  ProviderResult,
  ProviderUsage,
  ReviewProvider,
  Verdict,
} from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";

/** A tool call as OpenAI-compatible chat completions return it. */
interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** The chat-completion response fields the OpenRouter provider reads. */
/** The usage block OpenAI-compatible chat completions may return. */
interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  /** OpenRouter usage accounting's cost in USD. */
  cost?: number;
}

interface ChatCompletionResponse {
  choices: {
    message: { role: string; content: string | null; tool_calls?: ToolCall[] };
  }[];
  usage?: ChatCompletionUsage;
}

/**
 * The default reviewer provider: OpenAI-compatible chat completions with
 * required tool calling, via OpenRouter or any endpoint speaking the
 * same protocol (per-reviewer `baseUrl`).
 *
 * Request `options` are spread first, so they can add backend fields
 * (e.g. OpenRouter routing or reasoning settings) but never clobber
 * the protocol fields praxis owns: model, messages, tools,
 * tool_choice, temperature, stream.
 *
 * `stream` is owned and pinned false. This provider reads one whole
 * JSON body and wants one tool call out of it; an SSE response would
 * reach `response.json()` as a `data:` stream and fail to parse. Praxis
 * shows a live elapsed line while a call runs (09) rather than
 * streaming tokens — a tool call's arguments are not usable until they
 * are complete — so nothing here has a reason to stream.
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
    const { toolCall, data } = await this.requestToolCall(request);

    return {
      verdict: this.verdictFromToolCall(toolCall, this.parseArguments(toolCall, data)),
      usage: this.normalizeUsage(data.usage),
    };
  }

  /**
   * One raw structured-output call: same endpoint and protocol as a
   * review, but the tool call comes back unparsed — the curator's
   * prompts own their own shapes.
   *
   * @throws PraxisError on non-OK responses or a missing tool call
   */
  async complete(request: ProviderRequest): Promise<ProviderCompletion> {
    const { toolCall, data } = await this.requestToolCall(request);

    return {
      toolName: toolCall.function.name,
      args: this.parseArguments(toolCall, data),
      usage: this.normalizeUsage(data.usage),
    };
  }

  /**
   * The shared wire exchange: one POST, one required tool call back.
   *
   * @throws PraxisError on a non-OK response or a missing tool call
   */
  private async requestToolCall(
    request: ProviderRequest,
  ): Promise<{ toolCall: ToolCall; data: ChatCompletionResponse }> {
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
        stream: false,
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

    return { toolCall, data };
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
   * Two different things arrive here and they want opposite advice. A
   * completion cut off at max_tokens ends mid-token and is fixed in
   * config; a model that simply emitted bad JSON — an unescaped quote
   * or a raw newline inside a long `reason` — ran to completion and is
   * fixed by rerunning. `finish_reason` tells them apart, so only the
   * truncated case is told to raise max_tokens.
   *
   * The parse error itself is what localizes the fault, so it is
   * reported rather than swallowed, with the text either side of the
   * position it names.
   */
  private parseArguments(toolCall: ToolCall, data: ChatCompletionResponse): unknown {
    const raw = toolCall.function.arguments;

    try {
      return JSON.parse(raw) as unknown;
    } catch (err) {
      const finishReason =
        (data.choices[0] as { finish_reason?: string }).finish_reason ?? "unknown";
      const reason = err instanceof Error ? err.message : String(err);
      const truncated = finishReason === "length";
      const advice = truncated
        ? "the response was cut off — raise max_tokens in the model's options"
        : "the response was not truncated, so the model emitted malformed JSON — rerun to retry";

      throw errors.reviewerApiError(
        this.name,
        200,
        `tool call arguments are not valid JSON: ${reason} — near: "${excerpt(raw, reason)}" (finish_reason: ${finishReason}, ${raw.length} chars; ${advice})`,
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

/** Characters of context shown either side of a parse failure. */
const EXCERPT_RADIUS = 60;

/**
 * The text around the position a parse error names.
 *
 * V8 reports "… at position N" for anything long enough to matter; when
 * it does not, the head of the payload is the next best thing — the
 * point is always to show the caller actual characters rather than a
 * length.
 */
function excerpt(raw: string, reason: string): string {
  const at = /at position (\d+)/.exec(reason)?.[1];

  if (at === undefined) return clip(raw, 0, EXCERPT_RADIUS * 2);

  const position = Number(at);

  return clip(raw, Math.max(0, position - EXCERPT_RADIUS), position + EXCERPT_RADIUS);
}

/** A slice of the payload, marked where it was cut, with newlines made visible. */
function clip(raw: string, from: number, to: number): string {
  const lead = from > 0 ? "…" : "";
  const trail = to < raw.length ? "…" : "";
  const body = raw.slice(from, to).replace(/\n/g, "\\n").replace(/\r/g, "\\r");

  return `${lead}${body}${trail}`;
}
