/**
 * AI Provider wrapper — Gemini primario + Groq fallback.
 *
 * Estrategia:
 * - Gemini 2.0 Flash: free tier 15 req/min, 1500 req/día, 1M context, mejor
 *   español, function calling maduro. Es el primario por calidad.
 * - Groq Llama-3.3-70B Versatile: free tier 30 req/min, 14.4K req/día, ~200ms
 *   latencia, function calling vía OpenAI-compatible API. Es el fallback.
 *
 * Cuando Gemini devuelve 429 (quota) o 5xx (downtime), automáticamente
 * intentamos con Groq. El cliente NO percibe diferencia.
 *
 * Setup:
 * - GEMINI_API_KEY: obligatorio (sin él, fallback canned response)
 * - GROQ_API_KEY: opcional. Sin él, solo Gemini.
 *
 * El system prompt + tools schema son idénticos en ambos providers porque
 * el sistema de function calling de Groq es compatible OpenAI y Gemini
 * mapea 1:1 a esa estructura (params, required, etc.).
 */

import { logSafeError } from "@jurmaq/shared/logging";
import { env } from "@jurmaq/shared/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export type AiToolHandler = (args: Record<string, unknown>) => Promise<string> | string;

export interface AiCallOptions {
  systemPrompt: string;
  messages: AiMessage[];
  tools: AiToolDef[];
  toolHandlers: Record<string, AiToolHandler>;
  /** Side-effect callback invocado cuando un tool retorna `meta` para UI */
  onToolUi?: (toolName: string, parsedResult: unknown) => void;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AiCallResult {
  text: string;
  /** Si el último tool call devolvió un `meta.ui` lo exponemos acá */
  ui?: unknown;
  provider: "gemini" | "groq" | "canned";
}

// ---------------------------------------------------------------------------
// Gemini caller
// ---------------------------------------------------------------------------

const GEMINI_MODEL = "gemini-2.0-flash";

async function callGemini(
  opts: AiCallOptions,
  apiKey: string,
): Promise<AiCallResult> {
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body = {
    contents,
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    tools: [{ function_declarations: opts.tools }],
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 800,
      temperature: opts.temperature ?? 0.3,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const status = res.status;
    // 429 = rate limit, 5xx = downtime → permitir fallback
    if (status === 429 || status >= 500) {
      throw new ProviderError("gemini", status, errText.slice(0, 200));
    }
    throw new Error(`gemini ${status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error("gemini sin candidato");

  const funcCall = candidate.content?.parts?.find(
    (p: { functionCall?: unknown }) => p.functionCall,
  );

  if (funcCall?.functionCall) {
    const { name, args } = funcCall.functionCall as {
      name: string;
      args: Record<string, unknown>;
    };
    const handler = opts.toolHandlers[name];
    let toolResult = "";
    if (handler) {
      try {
        toolResult = await handler(args ?? {});
      } catch (e) {
        toolResult = JSON.stringify({ error: e instanceof Error ? e.message : "tool failed" });
      }
    } else {
      toolResult = JSON.stringify({ error: `Tool ${name} no implementada` });
    }

    // Parse para extraer UI metadata si el tool lo emitió
    let parsed: unknown;
    try {
      parsed = JSON.parse(toolResult);
    } catch {
      parsed = null;
    }
    if (opts.onToolUi && parsed) opts.onToolUi(name, parsed);

    // Re-call Gemini con tool result
    const followUp = {
      ...body,
      contents: [
        ...contents,
        { role: "model", parts: [{ functionCall: funcCall.functionCall }] },
        {
          role: "user",
          parts: [{ functionResponse: { name, response: { result: toolResult } } }],
        },
      ],
    };
    const res2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(followUp),
    });
    if (!res2.ok) {
      const status2 = res2.status;
      if (status2 === 429 || status2 >= 500) {
        throw new ProviderError("gemini", status2, "follow-up failed");
      }
      throw new Error(`gemini follow-up ${status2}`);
    }
    const data2 = await res2.json();
    const text =
      data2.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)
        ?.text ?? "No pude generar respuesta.";
    return {
      text,
      provider: "gemini",
      ui: parsed && typeof parsed === "object" && "meta" in parsed
        ? (parsed as { meta?: unknown }).meta
        : undefined,
    };
  }

  // Plain text response
  const text =
    candidate.content?.parts?.find((p: { text?: string }) => p.text)?.text ??
    "No pude generar respuesta.";
  return { text, provider: "gemini" };
}

// ---------------------------------------------------------------------------
// Groq caller (OpenAI-compatible API)
// ---------------------------------------------------------------------------

// llama-3.3-70b-versatile = 70B params, 128K context, soporta tool calling
// custom, free tier 30 RPM / 6K TPM. Es el modelo más capaz de Groq que
// acepta function calling — usamos esto en lugar de groq/compound (que es
// agentic y NO permite tools custom del cliente, solo tools internas como
// web search). Comprobado 2026-05-27 con error 400 "tool calling is not
// supported with this model" para groq/compound.
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

async function callGroq(
  opts: AiCallOptions,
  apiKey: string,
): Promise<AiCallResult> {
  // Convert to OpenAI format
  const messages = [
    { role: "system" as const, content: opts.systemPrompt },
    ...opts.messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  const tools = opts.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const body = {
    model: GROQ_MODEL,
    messages,
    tools,
    tool_choice: "auto" as const,
    max_tokens: opts.maxOutputTokens ?? 800,
    temperature: opts.temperature ?? 0.3,
  };

  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`groq ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("groq sin choice");

  const toolCalls = choice.message?.tool_calls as
    | { id: string; function: { name: string; arguments: string } }[]
    | undefined;

  if (toolCalls && toolCalls.length > 0) {
    const firstCall = toolCalls[0];
    const name = firstCall.function.name;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(firstCall.function.arguments);
    } catch {
      args = {};
    }
    const handler = opts.toolHandlers[name];
    let toolResult = "";
    if (handler) {
      try {
        toolResult = await handler(args);
      } catch (e) {
        toolResult = JSON.stringify({ error: e instanceof Error ? e.message : "tool failed" });
      }
    } else {
      toolResult = JSON.stringify({ error: `Tool ${name} no implementada` });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(toolResult);
    } catch {
      parsed = null;
    }
    if (opts.onToolUi && parsed) opts.onToolUi(name, parsed);

    // Re-call Groq with tool result
    const followBody = {
      ...body,
      messages: [
        ...messages,
        {
          role: "assistant" as const,
          tool_calls: toolCalls,
          content: choice.message.content ?? null,
        },
        {
          role: "tool" as const,
          tool_call_id: firstCall.id,
          content: toolResult,
        },
      ],
      tool_choice: "none" as const,
    };
    const res2 = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(followBody),
    });
    if (!res2.ok) {
      throw new Error(`groq follow-up ${res2.status}`);
    }
    const data2 = await res2.json();
    const text =
      data2.choices?.[0]?.message?.content ?? "No pude generar respuesta.";
    return {
      text,
      provider: "groq",
      ui: parsed && typeof parsed === "object" && "meta" in parsed
        ? (parsed as { meta?: unknown }).meta
        : undefined,
    };
  }

  const text = choice.message?.content ?? "No pude generar respuesta.";
  return { text, provider: "groq" };
}

// ---------------------------------------------------------------------------
// Main entry: callAI con fallback transparente
// ---------------------------------------------------------------------------

class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    msg: string,
  ) {
    super(`${provider} ${status}: ${msg}`);
  }
}

/**
 * Llama AI con fallback automático. Si Gemini falla con 429 o 5xx,
 * intenta con Groq. Si ambos fallan, throw.
 */
export async function callAI(opts: AiCallOptions): Promise<AiCallResult> {
  const geminiKey = env.GEMINI_API_KEY;
  const groqKey = env.GROQ_API_KEY;

  // Caso 1: ambas keys ausentes → canned
  if (!geminiKey && !groqKey) {
    return {
      text: "Aún no tengo IA configurada. Mientras tanto, contáctanos por WhatsApp +56 9 7667 3577.",
      provider: "canned",
    };
  }

  // Caso 2: solo Gemini
  if (geminiKey && !groqKey) {
    return callGemini(opts, geminiKey);
  }

  // Caso 3: solo Groq
  if (!geminiKey && groqKey) {
    return callGroq(opts, groqKey);
  }

  // Caso 4: ambas → Gemini primero, Groq fallback en 429/5xx
  try {
    return await callGemini(opts, geminiKey!);
  } catch (e) {
    if (e instanceof ProviderError && (e.status === 429 || e.status >= 500)) {
      logSafeError("[ai-provider] gemini fallback → groq", { status: e.status });
      try {
        return await callGroq(opts, groqKey!);
      } catch (e2) {
        logSafeError("[ai-provider] groq también falló", { err: String(e2).slice(0, 150) });
        throw e2;
      }
    }
    throw e;
  }
}
