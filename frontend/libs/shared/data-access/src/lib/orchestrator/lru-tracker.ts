/**
 * Doubly-linked-list based LRU (Least Recently Used) tracker.
 *
 * Provides O(1) `touch`, `evictOldest`, and `delete` operations.
 * Used internally by `IdentityMapStore` to enforce `maxCacheSize`.
 */

interface LruNode {
  key: string;
  prev: LruNode | null;
  next: LruNode | null;
}

export class LruTracker {
  private readonly _map = new Map<string, LruNode>();
  private readonly _head: LruNode = { key: '__HEAD__', prev: null, next: null };
  private readonly _tail: LruNode = { key: '__TAIL__', prev: null, next: null };

  public constructor() {
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /** Number of tracked entries. */
  public get size(): number {
    return this._map.size;
  }

  /**
   * Mark `key` as most-recently-used.
   * If the key doesn't exist yet, it is added.
   */
  public touch(key: string): void {
    let node = this._map.get(key);

    if (node) {
      // Detach from current position
      this._detach(node);
    } else {
      node = { key, prev: null, next: null };
      this._map.set(key, node);
    }

    // Attach right before tail (most recent)
    this._attachBeforeTail(node);
  }

  /**
   * Evict and return the least-recently-used key.
   * Returns `null` if the tracker is empty.
   */
  public evictOldest(): string | null {
    const oldest = this._head.next;
    if (!oldest || oldest === this._tail) {
      return null;
    }

    this._detach(oldest);
    this._map.delete(oldest.key);
    return oldest.key;
  }

  /**
   * Remove a specific key from tracking.
   */
  public delete(key: string): void {
    const node = this._map.get(key);
    if (node) {
      this._detach(node);
      this._map.delete(key);
    }
  }

  /**
   * Check if a key is being tracked.
   */
  public has(key: string): boolean {
    return this._map.has(key);
  }

  /**
   * Clear all tracked entries.
   */
  public clear(): void {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  // ── Internal linked-list operations ──

  private _detach(node: LruNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = null;
  }

  private _attachBeforeTail(node: LruNode): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const prev = this._tail.prev!;
    prev.next = node;
    node.prev = prev;
    node.next = this._tail;
    this._tail.prev = node;
  }
}
