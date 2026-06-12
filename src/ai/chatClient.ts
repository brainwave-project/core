/**
 * Ollama chat client + RAG prompt assembly — local, streaming, no SDK.
 *
 * Phase 2 (Conversational RAG) generation primitives. Mirrors the dependency-
 * light, native-fetch style of `embedder.ts`: all inference runs on the in-
 * network Ollama service (e.g. llama3.1:8b-instruct), so no document text, no
 * prompt, and no completion ever leaves the Docker network.
 *
 * POST {baseUrl}/api/chat  body: { model, stream:true, options, messages }
 *   → newline-delimited JSON (NDJSON): one object per token-ish increment,
 *     ending with a final object carrying timing + token counts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** A retrieved passage that may be packed into the grounded prompt. */
export interface RagContextChunk {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
}

export interface OllamaChatOptions {
  baseUrl?: string; // default: http://ollama:11434
  model?: string; // default: 'llama3.1:8b-instruct-q4_K_M'
  temperature?: number; // default: 0.2 (faithful, low-variance)
  numCtx?: number; // context window budget; default: 8192
  numPredict?: number; // max answer tokens; default: 1024
  timeoutMs?: number; // connect/idle timeout; default: 120000
  /** External cancellation (e.g. client disconnected) — frees the GPU. */
  signal?: AbortSignal;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalDurationMs: number;
}

/** One streamed increment. `done` is true exactly once, on the final frame. */
export interface ChatToken {
  content: string;
  done: boolean;
  usage?: ChatUsage;
}

interface ResolvedChatOptions {
  baseUrl: string;
  model: string;
  temperature: number;
  numCtx: number;
  numPredict: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

function resolve(opts: OllamaChatOptions): ResolvedChatOptions {
  return {
    baseUrl: (opts.baseUrl ?? 'http://ollama:11434').replace(/\/+$/, ''),
    model: opts.model ?? 'llama3.1:8b-instruct-q4_K_M',
    temperature: opts.temperature ?? 0.2,
    numCtx: opts.numCtx ?? 8192,
    numPredict: opts.numPredict ?? 1024,
    timeoutMs: opts.timeoutMs ?? 120_000,
    signal: opts.signal,
  };
}

// ---------------------------------------------------------------------------
// Token estimation — heuristic, no heavyweight tokenizer dependency
// ---------------------------------------------------------------------------

/**
 * Estimate token count from character length (~4 chars/token in English).
 * Consistent with Phase 1's "no heavy dependencies" rule. We deliberately
 * round up so an estimate errs toward leaving budget headroom, never toward
 * silently overflowing the context window.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Grounded prompt assembly + token budgeting
// ---------------------------------------------------------------------------

export interface AssemblePromptParams {
  chunks: RagContextChunk[];
  history: ChatMessage[];
  question: string;
  /** Token budget for the packed CONTEXT block (e.g. RAG_MAX_CONTEXT_TOKENS). */
  budgetTokens: number;
  /** Token budget reserved for trimmed conversation history. Default 1000. */
  historyBudgetTokens?: number;
  /** Override the system instructions. Falls back to the built-in grounding prompt if omitted. */
  systemInstructions?: string;
}

export interface AssembledPrompt {
  messages: ChatMessage[];
  /** Chunks that actually fit the budget — the basis for citations [n]. */
  usedChunks: RagContextChunk[];
}

const SYSTEM_INSTRUCTIONS = [
  "You are Brainwave's assistant. Answer the user's question using ONLY the",
  'CONTEXT below. If the answer is not in the context, say you don\'t know —',
  'do not invent facts. Cite sources inline with [n] matching the context blocks.',
].join('\n');

/**
 * Pack retrieved chunks + trimmed history + the question into the message array
 * Ollama expects. Greedy by relevance: chunks arrive sorted by score and are
 * added while they fit the budget, most-relevant first (mitigates the
 * "lost in the middle" failure mode). History is trimmed from the oldest end.
 */
export function assembleRagPrompt(p: AssemblePromptParams): AssembledPrompt {
  const historyBudget = p.historyBudgetTokens ?? 1000;

  // 1 — pack chunks greedily by score within the context budget.
  const sorted = [...p.chunks].sort((a, b) => b.score - a.score);
  const used: RagContextChunk[] = [];
  let running = 0;
  for (const chunk of sorted) {
    const cost = estimateTokens(chunk.content) + 16; // + framing overhead
    if (used.length > 0 && running + cost > p.budgetTokens) break;
    used.push(chunk);
    running += cost;
  }

  // 2 — render the CONTEXT block. Rank is 1-based and drives citation [n].
  const contextBlock =
    used.length > 0
      ? used
          .map((c, i) => `[${i + 1}] (from "${c.title || 'Untitled'}") ${c.content.trim()}`)
          .join('\n\n')
      : '(no relevant context found)';

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `${p.systemInstructions ?? SYSTEM_INSTRUCTIONS}\n\nCONTEXT:\n${contextBlock}`,
  };

  // 3 — trim history from the oldest end to fit its own budget.
  const trimmedHistory: ChatMessage[] = [];
  let historyTokens = 0;
  for (let i = p.history.length - 1; i >= 0; i--) {
    const turn = p.history[i];
    const cost = estimateTokens(turn.content) + 8;
    if (historyTokens + cost > historyBudget) break;
    trimmedHistory.unshift(turn);
    historyTokens += cost;
  }

  const userMessage: ChatMessage = { role: 'user', content: p.question };

  return {
    messages: [systemMessage, ...trimmedHistory, userMessage],
    usedChunks: used,
  };
}

/**
 * Build the temperature-0 query-condensation prompt. Rewrites an elliptical
 * follow-up ("what about its pricing?") into a standalone question using recent
 * history, so the retriever embeds a self-contained query. This is a
 * transformation, not a conversation — keep num_predict tight (~64).
 */
export function condenseQueryPrompt(question: string, history: ChatMessage[]): ChatMessage[] {
  const transcript = history
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: [
        'Given the conversation so far and a follow-up question, rewrite the',
        'follow-up as a single standalone question that can be understood without',
        'the conversation. Resolve all pronouns and references. Do not answer it.',
        'Output ONLY the rewritten question, nothing else.',
      ].join(' '),
    },
    {
      role: 'user',
      content: `Conversation:\n${transcript}\n\nFollow-up: ${question}\n\nStandalone question:`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Streaming generation
// ---------------------------------------------------------------------------

/**
 * Stream a chat completion from Ollama's /api/chat (NDJSON). Yields one
 * {content} per increment and a final {done:true, usage} frame. Relays tokens
 * verbatim so the caller can forward them over SSE. Honors an external
 * AbortSignal (client disconnect) so a navigated-away user frees the GPU
 * immediately. Throws on connection/HTTP failure — the caller decides recovery.
 */
export async function* streamChatWithOllama(
  messages: ChatMessage[],
  opts: OllamaChatOptions = {},
): AsyncGenerator<ChatToken> {
  const o = resolve(opts);
  const url = `${o.baseUrl}/api/chat`;

  // Local controller fires on idle timeout; also chained to the external signal.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (o.signal) {
    if (o.signal.aborted) controller.abort();
    else o.signal.addEventListener('abort', onAbort, { once: true });
  }
  let timer = setTimeout(() => controller.abort(), o.timeoutMs);
  const bump = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), o.timeoutMs);
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: o.model,
        stream: true,
        options: {
          temperature: o.temperature,
          num_ctx: o.numCtx,
          num_predict: o.numPredict,
        },
        messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const body = await safeText(res);
      throw new ChatError(`Ollama chat failed ${res.status}: ${body}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bump();
      buffer += decoder.decode(value, { stream: true });

      // NDJSON: process complete lines, keep the partial tail in the buffer.
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;

        const frame = parseFrame(line);
        if (!frame) continue;

        if (frame.done) {
          yield {
            content: frame.message?.content ?? '',
            done: true,
            usage: {
              promptTokens: frame.prompt_eval_count ?? 0,
              completionTokens: frame.eval_count ?? 0,
              totalDurationMs: Math.round((frame.total_duration ?? 0) / 1e6),
            },
          };
          return;
        }
        yield { content: frame.message?.content ?? '', done: false };
      }
    }
  } finally {
    clearTimeout(timer);
    if (o.signal) o.signal.removeEventListener('abort', onAbort);
  }
}

interface OllamaChatFrame {
  message?: { role: string; content: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

function parseFrame(line: string): OllamaChatFrame | null {
  try {
    return JSON.parse(line) as OllamaChatFrame;
  } catch {
    return null;
  }
}

class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '<no body>';
  }
}
