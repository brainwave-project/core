// AI / Semantic Layer primitives (Phase 1) — chunking, local embedding, query cache.
export { chunkText } from './chunker.js';
export type { TextChunk, ChunkOptions } from './chunker.js';

export { embedWithOllama, embedQuery, toPgVector } from './embedder.js';
export type { OllamaEmbedOptions } from './embedder.js';

export { getQueryVectorCache } from './queryCache.js';
export type { QueryVectorCache, QueryCacheOptions } from './queryCache.js';

// Conversational RAG (Phase 2) — local chat generation + grounded prompt assembly.
export {
  streamChatWithOllama,
  assembleRagPrompt,
  estimateTokens,
  condenseQueryPrompt,
} from './chatClient.js';
export type {
  ChatRole,
  ChatMessage,
  RagContextChunk,
  OllamaChatOptions,
  ChatUsage,
  ChatToken,
  AssemblePromptParams,
  AssembledPrompt,
} from './chatClient.js';
