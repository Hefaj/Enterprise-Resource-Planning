import { signal, computed, Signal, WritableSignal } from '@angular/core';
import { LruTracker } from './lru-tracker';
import { HasUuid } from './orchestrator.types';

/**
 * Generic, centralized Identity Map store for normalized aggregates.
 *
 * Design principles:
 * - **Granular signals**: Each aggregate is stored in its own `WritableSignal<TDto>`,
 *   so updating one aggregate does NOT trigger re-renders for unrelated entries.
 * - **LRU eviction**: Enforces `maxCacheSize` to prevent unbounded memory growth.
 * - **Single source of truth**: One store instance per aggregate type, preventing
 *   data duplication across components.
 *
 * This is NOT an Angular @Injectable — each `BaseOrchestrator` creates and owns
 * its own `IdentityMapStore` instance for its aggregate type.
 */
export class IdentityMapStore<TDto extends HasUuid> {
  private readonly _entries = new Map<string, WritableSignal<TDto>>();
  private readonly _lru: LruTracker;
  private readonly _maxCacheSize: number;

  /**
   * Reactive signal tracking the set of currently cached UUIDs.
   * Updated on every add/remove operation to allow derived signals
   * to react to store membership changes.
   */
  private readonly _version = signal(0);

  public constructor(maxCacheSize: number) {
    this._maxCacheSize = maxCacheSize;
    this._lru = new LruTracker();
  }

  // ────────────────────────────────────────────────────────────────
  // Read Operations
  // ────────────────────────────────────────────────────────────────

  /**
   * Get a reactive signal for a single aggregate.
   * Returns `undefined` if the UUID is not in the cache.
   */
  public get(uuid: string): Signal<TDto | undefined> {
    const entry = this._entries.get(uuid);
    if (entry) {
      this._lru.touch(uuid);
      return entry.asReadonly();
    }
    // Return a stable computed that reacts to store changes
    return computed(() => {
      this._version(); // track reactivity
      const current = this._entries.get(uuid);
      return current ? current() : undefined;
    });
  }

  /**
   * Get a snapshot of the raw DTO value (non-reactive).
   * Returns `undefined` if not cached.
   */
  public peek(uuid: string): TDto | undefined {
    const entry = this._entries.get(uuid);
    if (entry) {
      this._lru.touch(uuid);
      return entry();
    }
    return undefined;
  }

  /**
   * Get many aggregates as a reactive `Signal<Map<uuid, TDto>>`.
   * Only emits when any of the requested UUIDs change.
   */
  public getMany(uuids: string[]): Signal<Map<string, TDto>> {
    return computed(() => {
      this._version(); // track membership changes
      const result = new Map<string, TDto>();
      for (const uuid of uuids) {
        const entry = this._entries.get(uuid);
        if (entry) {
          result.set(uuid, entry());
        }
      }
      return result;
    });
  }

  /**
   * Get all cached aggregates as a reactive `Signal<Map<uuid, TDto>>`.
   */
  public getAll(): Signal<Map<string, TDto>> {
    return computed(() => {
      this._version(); // track membership changes
      const result = new Map<string, TDto>();
      for (const [uuid, entry] of this._entries) {
        result.set(uuid, entry());
      }
      return result;
    });
  }

  /**
   * Get individual signals for each UUID.
   * Used for `getSignalViewModel()` — enables per-row reactivity in tables.
   */
  public getSignals(uuids: string[]): Map<string, Signal<TDto>> {
    const result = new Map<string, Signal<TDto>>();
    for (const uuid of uuids) {
      const entry = this._entries.get(uuid);
      if (entry) {
        this._lru.touch(uuid);
        result.set(uuid, entry.asReadonly());
      }
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // Write Operations
  // ────────────────────────────────────────────────────────────────

  /**
   * Upsert a single aggregate. If the UUID exists, its signal is updated
   * in place (preserving signal identity for existing subscribers).
   */
  public set(dto: TDto): void {
    const uuid = dto.uuid;
    const existing = this._entries.get(uuid);

    if (existing) {
      existing.set(dto);
      this._lru.touch(uuid);
    } else {
      this._entries.set(uuid, signal(dto));
      this._lru.touch(uuid);
      this._evictIfNeeded();
      this._version.update(v => v + 1);
    }
  }

  /**
   * Upsert many aggregates at once.
   */
  public setMany(dtos: TDto[]): void {
    let added = false;
    for (const dto of dtos) {
      const uuid = dto.uuid;
      const existing = this._entries.get(uuid);

      if (existing) {
        existing.set(dto);
        this._lru.touch(uuid);
      } else {
        this._entries.set(uuid, signal(dto));
        this._lru.touch(uuid);
        added = true;
      }
    }

    if (added) {
      this._evictIfNeeded();
      this._version.update(v => v + 1);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Query Operations
  // ────────────────────────────────────────────────────────────────

  /** Check if a UUID is in the cache. */
  public has(uuid: string): boolean {
    return this._entries.has(uuid);
  }

  /** Filter a list of UUIDs to only those missing from the cache. */
  public getMissing(uuids: string[]): string[] {
    return uuids.filter(uuid => !this._entries.has(uuid));
  }

  /** Current number of cached entries. */
  public get size(): number {
    return this._entries.size;
  }

  // ────────────────────────────────────────────────────────────────
  // Removal Operations
  // ────────────────────────────────────────────────────────────────

  /** Remove a single aggregate from the cache. */
  public delete(uuid: string): void {
    if (this._entries.delete(uuid)) {
      this._lru.delete(uuid);
      this._version.update(v => v + 1);
    }
  }

  /** Clear the entire cache. */
  public clear(): void {
    this._entries.clear();
    this._lru.clear();
    this._version.update(v => v + 1);
  }

  // ────────────────────────────────────────────────────────────────
  // LRU Eviction
  // ────────────────────────────────────────────────────────────────

  private _evictIfNeeded(): void {
    while (this._entries.size > this._maxCacheSize) {
      const oldest = this._lru.evictOldest();
      if (oldest) {
        this._entries.delete(oldest);
      } else {
        break; // Safety: should not happen
      }
    }
  }
}
