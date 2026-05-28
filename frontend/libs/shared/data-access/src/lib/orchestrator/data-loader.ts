import { Subject, firstValueFrom, Observable } from 'rxjs';
import { bufferTime, filter, retry, take } from 'rxjs/operators';
import { IdentityMapStore } from './identity-map.store';
import { HasUuid, OrchestratorConfig } from './orchestrator.types';

/**
 * Intelligent request manager that serves as the heart of the data fetching system.
 *
 * Implements a multi-layered optimization pipeline:
 * 1. **Deduplication** — removes duplicate UUIDs from the request queue
 * 2. **Cache checking** — skips UUIDs already present in the IdentityMapStore
 * 3. **In-flight tracking** — prevents duplicate requests for the same UUID
 * 4. **Temporal batching** — collects individual calls into batches via `bufferTime`
 * 5. **Chunking** — splits large batches into configurable-size chunks
 * 6. **Retry with backoff** — exponential backoff for transient failures
 */
export class DataLoader<TDto extends HasUuid> {
  private readonly _bufferSubject = new Subject<LoadRequest>();
  private readonly _pendingRequests = new Map<string, Promise<void>>();
  private readonly _identityMap: IdentityMapStore<TDto>;
  private readonly _fetchFn: (uuids: string[]) => Observable<TDto[]>;
  private readonly _config: OrchestratorConfig;

  public constructor(
    fetchFn: (uuids: string[]) => Observable<TDto[]>,
    identityMap: IdentityMapStore<TDto>,
    config: OrchestratorConfig,
  ) {
    this._fetchFn = fetchFn;
    this._identityMap = identityMap;
    this._config = config;

    this._initBufferPipeline();
  }

  // ────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────

  /**
   * Request loading of one or more aggregates by UUID.
   *
   * This method is designed to be called frequently from many components.
   * Calls are batched, deduplicated, and optimized automatically.
   *
   * Returns a Promise that resolves when ALL requested UUIDs are available
   * in the IdentityMapStore (either from cache or freshly fetched).
   */
  public async loadAsync(uuids: string[]): Promise<void> {
    if (uuids.length === 0) return;

    // Step 1: Deduplicate
    const unique = [...new Set(uuids)];

    // Step 2: Filter out already-cached UUIDs
    const missing = this._identityMap.getMissing(unique);
    if (missing.length === 0) return;

    // Step 3: Filter out in-flight UUIDs, but keep their promises
    const toFetch: string[] = [];
    const existingPromises: Promise<void>[] = [];

    for (const uuid of missing) {
      const pending = this._pendingRequests.get(uuid);
      if (pending) {
        existingPromises.push(pending);
      } else {
        toFetch.push(uuid);
      }
    }

    // Step 4: Enqueue new UUIDs into the buffer pipeline
    let newPromise: Promise<void> | undefined;

    if (toFetch.length > 0) {
      newPromise = new Promise<void>((resolve, reject) => {
        this._bufferSubject.next({ uuids: toFetch, resolve, reject });
      });

      // Register pending promises for all new UUIDs
      for (const uuid of toFetch) {
        this._pendingRequests.set(uuid, newPromise);
      }
    }

    // Wait for all — both existing in-flight and newly queued
    const allPromises = [...existingPromises];
    if (newPromise) {
      allPromises.push(newPromise);
    }

    await Promise.all(allPromises);
  }

  /**
   * Force a reload of specific UUIDs, bypassing the cache check.
   * Used by SignalR refresh to update stale data.
   */
  public async reloadAsync(uuids: string[]): Promise<void> {
    if (uuids.length === 0) return;

    const unique = [...new Set(uuids)];
    const chunks = this._chunkArray(unique, this._config.maxChunkSize);

    await Promise.all(chunks.map(chunk => this._fetchChunkWithRetry(chunk)));
  }

  /**
   * Clean up resources.
   */
  public destroy(): void {
    this._bufferSubject.complete();
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: Buffer Pipeline
  // ────────────────────────────────────────────────────────────────

  private _initBufferPipeline(): void {
    this._bufferSubject
      .pipe(
        bufferTime(this._config.bufferTimeMs),
        filter(batch => batch.length > 0),
      )
      .subscribe(batch => {
        this._processBatch(batch);
      });
  }

  private async _processBatch(batch: LoadRequest[]): Promise<void> {
    // Merge all UUIDs from the batch, deduplicate again
    const allUuids = new Set<string>();
    for (const request of batch) {
      for (const uuid of request.uuids) {
        allUuids.add(uuid);
      }
    }

    // Final cache check (some may have been loaded by a concurrent batch)
    const missing = this._identityMap.getMissing([...allUuids]);

    if (missing.length === 0) {
      // Everything cached — resolve all promises
      for (const request of batch) {
        request.resolve();
      }
      this._cleanPending([...allUuids]);
      return;
    }

    // Chunk and fetch
    const chunks = this._chunkArray(missing, this._config.maxChunkSize);

    try {
      await Promise.all(chunks.map(chunk => this._fetchChunkWithRetry(chunk)));

      // All succeeded — resolve all batch promises
      for (const request of batch) {
        request.resolve();
      }
    } catch (err) {
      // If any chunk fails after retries, reject all batch promises
      for (const request of batch) {
        request.reject(err);
      }
    } finally {
      this._cleanPending([...allUuids]);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: Fetch with Retry
  // ────────────────────────────────────────────────────────────────

  private async _fetchChunkWithRetry(uuids: string[]): Promise<void> {
    const source$ = this._fetchFn(uuids).pipe(
      retry({
        count: this._config.maxRetries,
        delay: (_error, retryIndex) => {
          const delayMs = this._config.retryDelayMs * Math.pow(2, retryIndex - 1);
          console.warn(
            `[DataLoader] Retry ${retryIndex}/${this._config.maxRetries} after ${delayMs}ms`,
            _error,
          );
          return new Observable<void>(subscriber => {
            const timeout = setTimeout(() => {
              subscriber.next(void 0);
              subscriber.complete();
            }, delayMs);
            return (): void => { clearTimeout(timeout); };
          });
        },
      }),
      take(1),
    );

    const dtos = await firstValueFrom(source$);
    this._identityMap.setMany(dtos);
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: Utilities
  // ────────────────────────────────────────────────────────────────

  private _chunkArray(arr: string[], size: number): string[][] {
    const result: string[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  private _cleanPending(uuids: string[]): void {
    for (const uuid of uuids) {
      this._pendingRequests.delete(uuid);
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Internal Types
// ────────────────────────────────────────────────────────────────

interface LoadRequest {
  uuids: string[];
  resolve: () => void;
  reject: (err: unknown) => void;
}
