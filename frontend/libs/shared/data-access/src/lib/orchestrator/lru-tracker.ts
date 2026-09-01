/**
 * LRU (Least Recently Used) oparty na liście dwukierunkowej.
 *
 * Zapewnia operacje `touch`, `evictOldest` oraz `delete` o złożoności O(1).
 * Używany wewnętrznie przez `IdentityMapStore` do wymuszania `maxCacheSize`.
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

  /** Klucze przypięte przez aktywną nakładkę optymistyczną (`ErpOptimisticStore`) — pomijane
   * przy eksmisji, żeby LRU nie wyrzuciło wpisu, na którym nakładka wciąż ma co patchować. */
  private readonly _pinned = new Set<string>();

  public constructor() {
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /** Liczba śledzonych wpisów. */
  public get size(): number {
    return this._map.size;
  }

  /**
   * Oznacz `key` jako ostatnio używany (most-recently-used).
   * Jeśli klucz jeszcze nie istnieje, zostanie dodany.
   */
  public touch(key: string): void {
    let node = this._map.get(key);

    if (node) {
      // Odłącz z bieżącej pozycji
      this._detach(node);
    } else {
      node = { key, prev: null, next: null };
      this._map.set(key, node);
    }

    // Dołącz tuż przed ogonem (tail - najnowszy)
    this._attachBeforeTail(node);
  }

  /**
   * Usuń i zwróć najdawniej używany klucz (least-recently-used), pomijając klucze przypięte
   * (patrz {@link pin}). Zwraca `null`, gdy tracker jest pusty albo gdy WSZYSTKIE wpisy są
   * przypięte — w takim przypadku eksmisja po prostu nic nie robi, cache rośnie ponad limit
   * do czasu odpięcia; przypiętych wpisów jest z natury niewiele (aktywne nakładki), więc to
   * nie jest ścieżka, którą trzeba chronić przed nieograniczonym wzrostem.
   */
  public evictOldest(): string | null {
    let node = this._head.next;

    while (node && node !== this._tail) {
      if (!this._pinned.has(node.key)) {
        this._detach(node);
        this._map.delete(node.key);
        return node.key;
      }

      node = node.next;
    }

    return null;
  }

  /**
   * Usuń określony klucz ze śledzenia.
   */
  public delete(key: string): void {
    const node = this._map.get(key);
    if (node) {
      this._detach(node);
      this._map.delete(key);
    }
    this._pinned.delete(key);
  }

  /**
   * Sprawdź, czy klucz jest śledzony.
   */
  public has(key: string): boolean {
    return this._map.has(key);
  }

  /** Przypina klucz — eksmisja LRU go pomija, dopóki nie zostanie odpięty. */
  public pin(key: string): void {
    this._pinned.add(key);
  }

  /** Odpina klucz — znowu podlega zwykłej eksmisji LRU. */
  public unpin(key: string): void {
    this._pinned.delete(key);
  }

  /**
   * Wyczyść wszystkie śledzone wpisy.
   */
  public clear(): void {
    this._map.clear();
    this._pinned.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  // ── Wewnętrzne operacje na liście dwukierunkowej ──

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
