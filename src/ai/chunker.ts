/**
 * Text chunker — fixed-size, word-boundary splitting for embedding.
 *
 * Per Semantic Layer TDD ADR-AI-04: 512-token chunks with 64-token overlap.
 * nomic-embed-text supports 8192 tokens, so chunk size is a *retrieval-quality*
 * choice (a coherent paragraph), not a model limit. Overlap preserves sentence
 * continuity across boundaries so a concept split mid-idea is still findable.
 *
 * Tokenization is approximate by design: 1 token ≈ 0.75 words for English.
 * Exact BPE tokenization would require loading nomic's vocab (a heavy WASM dep)
 * for marginal benefit — chunks landing at ~490–530 tokens are acceptable.
 */

const WORDS_PER_TOKEN = 0.75; // 1 token ≈ 0.75 words → 512 tokens ≈ 384 words

export interface TextChunk {
  content: string;
  index: number; // 0-based position in the document
  tokenCount: number; // approximate word-boundary token count
}

export interface ChunkOptions {
  maxTokens?: number; // default: 512
  overlap?: number; // default: 64
}

/** Approximate token count for a run of words. */
function approxTokens(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_TOKEN);
}

/**
 * Split text into overlapping fixed-size chunks on word boundaries.
 * Returns [] for empty/whitespace-only input.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): TextChunk[] {
  const maxTokens = opts.maxTokens ?? 512;
  const overlap = opts.overlap ?? 64;

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const maxWords = Math.max(1, Math.floor(maxTokens * WORDS_PER_TOKEN));
  const overlapWords = Math.max(0, Math.min(maxWords - 1, Math.floor(overlap * WORDS_PER_TOKEN)));
  const step = Math.max(1, maxWords - overlapWords);

  const chunks: TextChunk[] = [];
  let index = 0;

  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + maxWords);
    chunks.push({
      content: slice.join(' '),
      index: index++,
      tokenCount: approxTokens(slice.length),
    });
    // Final window reached the end — stop before emitting a tail-overlap duplicate.
    if (start + maxWords >= words.length) break;
  }

  return chunks;
}
