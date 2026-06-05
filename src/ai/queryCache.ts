/**
 * LRU cache for query embedding vectors.
 *
 * Per Semantic Layer TDD §4.3: embedding a search query on CPU costs 2–3s. This
 * is the ONE non-optional cache in Phase 1 — without it every search pays that
 * latency. We cache the query *vector*, never results: result sets must always
 * reflect the live index.
 *
 * Hand-rolled over a Map (insertion-order = recency). Keyed on
 * normalized(query) + model. TTL default 5 min, max 500 entries.
 */

export interface QueryVectorCache {
  get(query: string): Float32Array | undefined;
  set(query: string, vector: Float32Array): void;
  clear(): void;
  readonly size: number;
}

export interface QueryCacheOptions {
  maxSize?: number; // default: 500
  ttlMs?: number; // default: 300000 (5 min)
  model?: string; // folded into the key so a model swap can't return stale vectors
}

interface Entry {
  vector: Float32Array;
  expiresAt: number;
}

class LruQueryVectorCache implements QueryVectorCache {
  private readonly store = new Map<string, Entry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly model: string;

  constructor(opts: QueryCacheOptions) {
    this.maxSize = opts.maxSize ?? 500;
    this.ttlMs = opts.ttlMs ?? 300_000;
    this.model = opts.model ?? 'nomic-embed-text';
  }

  private key(query: string): string {
    return `${this.model}::${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  }

  get(query: string): Float32Array | undefined {
    const k = this.key(query);
    const entry = this.store.get(k);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(k);
      return undefined;
    }
    // Touch for LRU recency: re-insert at the tail.
    this.store.delete(k);
    this.store.set(k, entry);
    return entry.vector;
  }

  set(query: string, vector: Float32Array): void {
    const k = this.key(query);
    this.store.delete(k);
    this.store.set(k, { vector, expiresAt: Date.now() + this.ttlMs });

    // Evict least-recently-used (the oldest insertion) until within bounds.
    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

let singleton: LruQueryVectorCache | undefined;

/**
 * Returns the process-wide query vector cache, creating it on first call.
 * Subsequent calls return the same instance (later options are ignored).
 */
export function getQueryVectorCache(opts: QueryCacheOptions = {}): QueryVectorCache {
  if (!singleton) singleton = new LruQueryVectorCache(opts);
  return singleton;
}
