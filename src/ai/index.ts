// AI / Semantic Layer primitives (Phase 1) — chunking, local embedding, query cache.
export { chunkText } from './chunker.js';
export type { TextChunk, ChunkOptions } from './chunker.js';

export { embedWithOllama, embedQuery, toPgVector } from './embedder.js';
export type { OllamaEmbedOptions } from './embedder.js';

export { getQueryVectorCache } from './queryCache.js';
export type { QueryVectorCache, QueryCacheOptions } from './queryCache.js';
