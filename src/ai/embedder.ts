/**
 * Ollama embedding client — local, batched, no SDK.
 *
 * Per Semantic Layer TDD ADR-AI-02: all inference runs on the in-network Ollama
 * service (nomic-embed-text, 768-dim). Uses native fetch (Node 18+) — no API
 * key, no third-party SDK, no document text leaving the Docker network.
 *
 * POST {baseUrl}/api/embed  body: { model, input: string[] }
 *   → { model, embeddings: number[][] }   (Ollama returns float64)
 * We narrow to Float32Array — acceptable precision for pgvector cosine search.
 */

import type { TextChunk } from './chunker.js';

export interface OllamaEmbedOptions {
  baseUrl?: string; // default: http://ollama:11434
  model?: string; // default: 'nomic-embed-text'
  batchSize?: number; // chunks per POST /api/embed call; default: 8
  timeoutMs?: number; // per-request timeout; default: 30000
  maxRetries?: number; // retries on 5xx / network error; default: 2
}

interface ResolvedOptions {
  baseUrl: string;
  model: string;
  batchSize: number;
  timeoutMs: number;
  maxRetries: number;
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

function resolve(opts: OllamaEmbedOptions): ResolvedOptions {
  return {
    baseUrl: (opts.baseUrl ?? 'http://ollama:11434').replace(/\/+$/, ''),
    model: opts.model ?? 'nomic-embed-text',
    batchSize: opts.batchSize ?? 8,
    timeoutMs: opts.timeoutMs ?? 30_000,
    maxRetries: opts.maxRetries ?? 2,
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Embed a single batch of input strings. Returns one vector per input, in order.
 * Retries on 5xx and network/timeout errors; a 4xx is treated as permanent.
 * Returns null (for every input in the batch) only after retries are exhausted.
 */
async function embedBatch(inputs: string[], o: ResolvedOptions): Promise<Array<Float32Array | null>> {
  const url = `${o.baseUrl}/api/embed`;

  for (let attempt = 0; attempt <= o.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), o.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: o.model, input: inputs }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // 4xx — bad request / model missing: retrying won't help.
        if (res.status >= 400 && res.status < 500) {
          throw new EmbedError(`Ollama embed failed ${res.status}: ${await safeText(res)}`, false);
        }
        throw new EmbedError(`Ollama embed failed ${res.status}: ${await safeText(res)}`, true);
      }

      const data = (await res.json()) as OllamaEmbedResponse;
      if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length) {
        throw new EmbedError(
          `Ollama returned ${data.embeddings?.length ?? 0} embeddings for ${inputs.length} inputs`,
          false,
        );
      }
      return data.embeddings.map((vec) => Float32Array.from(vec));
    } catch (err) {
      const retryable = isRetryable(err);
      if (!retryable || attempt === o.maxRetries) {
        return inputs.map(() => null);
      }
      await sleep(250 * (attempt + 1)); // linear backoff
    } finally {
      clearTimeout(timer);
    }
  }

  return inputs.map(() => null);
}

/**
 * Embed chunk objects. Returns Float32Array[768] per chunk in the same order,
 * or null for a chunk whose batch permanently failed.
 */
export async function embedWithOllama(
  chunks: TextChunk[],
  opts: OllamaEmbedOptions = {},
): Promise<Array<Float32Array | null>> {
  const o = resolve(opts);
  const results: Array<Float32Array | null> = [];

  for (let i = 0; i < chunks.length; i += o.batchSize) {
    const batch = chunks.slice(i, i + o.batchSize);
    const vectors = await embedBatch(batch.map((c) => c.content), o);
    results.push(...vectors);
  }

  return results;
}

/** Embed a single query string (search path). Returns null on failure. */
export async function embedQuery(query: string, opts: OllamaEmbedOptions = {}): Promise<Float32Array | null> {
  const o = resolve(opts);
  const [vec] = await embedBatch([query], o);
  return vec ?? null;
}

/** Serialize a Float32Array to the pgvector text literal: '[0.1,0.2,...]'. */
export function toPgVector(vec: Float32Array): string {
  return `[${Array.from(vec).join(',')}]`;
}

class EmbedError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'EmbedError';
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof EmbedError) return err.retryable;
  // AbortError (timeout) and network errors are transient.
  return true;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '<no body>';
  }
}
