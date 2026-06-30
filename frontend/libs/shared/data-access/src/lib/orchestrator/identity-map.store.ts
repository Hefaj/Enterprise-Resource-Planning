import { signal, computed, Signal, WritableSignal } from '@angular/core';
import { LruTracker } from './lru-tracker';
import { HasUuid } from './orchestrator.types';

/**
 * Generyczny, scentralizowany magazyn Identity Map dla znormalizowanych agregatów.
 *
 * Zasady projektowe:
 * - **Granularne sygnały (granular signals)**: Każdy agregat jest przechowywany we własnym `WritableSignal<TDto>`,
 *   dzięki czemu aktualizacja jednego agregatu NIE powoduje ponownego renderowania dla niepowiązanych wpisów.
 * - **Eksmisja LRU**: Wymusza `maxCacheSize`, aby zapobiec nieograniczonemu wzrostowi pamięci.
 * - **Pojedyncze źródło prawdy (Single source of truth)**: Jedna instancja magazynu na typ agregatu, zapobiegająca
 *   duplikowaniu danych w komponentach.
 *
 * To NIE jest Angularowy `@Injectable` — każdy `BaseOrchestrator` tworzy i posiada
 * własną instancję `IdentityMapStore` dla swojego typu agregatu.
 */
export class IdentityMapStore<TDto extends HasUuid> {
  private readonly _entries = new Map<string, WritableSignal<TDto>>();
  private readonly _lru: LruTracker;
  private readonly _maxCacheSize: number;

  /**
   * Reaktywny sygnał śledzący zestaw aktualnie zapisanych w cache UUID.
   * Aktualizowany przy każdej operacji dodawania/usuwania, aby umożliwić pochodnym sygnałom
   * reagowanie na zmiany członkostwa w magazynie.
   */
  private readonly _version = signal(0);

  public constructor(maxCacheSize: number) {
    this._maxCacheSize = maxCacheSize;
    this._lru = new LruTracker();
  }

  // ────────────────────────────────────────────────────────────────
  // Operacje Odczytu
  // ────────────────────────────────────────────────────────────────

  /**
   * Pobierz reaktywny sygnał dla pojedynczego agregatu.
   * Zwraca `undefined`, jeśli UUID nie znajduje się w cache.
   */
  public get(uuid: string): Signal<TDto | undefined> {
    const entry = this._entries.get(uuid);
    if (entry) {
      this._lru.touch(uuid);
      return entry.asReadonly();
    }
    // Zwróć stabilny computed, który reaguje na zmiany w magazynie
    return computed(() => {
      this._version(); // śledzenie reaktywności
      const current = this._entries.get(uuid);
      return current ? current() : undefined;
    });
  }

  /**
   * Pobierz migawkę (snapshot) surowej wartości DTO (niereaktywną).
   * Zwraca `undefined`, jeśli nie ma w cache.
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
   * Pobierz wiele agregatów jako reaktywny `Signal<Map<uuid, TDto>>`.
   * Emituje tylko wtedy, gdy którykolwiek z żądanych UUID ulegnie zmianie.
   */
  public getMany(uuids: string[]): Signal<Map<string, TDto>> {
    return computed(() => {
      this._version(); // śledzenie zmian członkostwa
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
   * Pobierz wszystkie zapisane w cache agregaty jako reaktywny `Signal<Map<uuid, TDto>>`.
   */
  public getAll(): Signal<Map<string, TDto>> {
    return computed(() => {
      this._version(); // śledzenie zmian członkostwa
      const result = new Map<string, TDto>();
      for (const [uuid, entry] of this._entries) {
        result.set(uuid, entry());
      }
      return result;
    });
  }

  /**
   * Pobierz pojedyncze sygnały dla każdego UUID.
   * Używane do `getSignalViewModel()` — umożliwia reaktywność dla każdego wiersza w tabelach.
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
  // Operacje Zapisu
  // ────────────────────────────────────────────────────────────────

  /**
   * Dodaj lub zaktualizuj pojedynczy agregat. Jeśli UUID istnieje, jego sygnał jest aktualizowany
   * w miejscu (zachowując tożsamość sygnału dla istniejących subskrybentów).
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
   * Dodaj lub zaktualizuj wiele agregatów naraz.
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
  // Operacje Zapytania
  // ────────────────────────────────────────────────────────────────

  /** Sprawdź, czy UUID znajduje się w cache. */
  public has(uuid: string): boolean {
    return this._entries.has(uuid);
  }

  /** Filtruj listę UUID do tylko tych brakujących w cache. */
  public getMissing(uuids: string[]): string[] {
    return uuids.filter(uuid => !this._entries.has(uuid));
  }

  /** Aktualna liczba zapisanych wpisów w cache. */
  public get size(): number {
    return this._entries.size;
  }

  // ────────────────────────────────────────────────────────────────
  // Operacje Usuwania
  // ────────────────────────────────────────────────────────────────

  /** Usuń pojedynczy agregat z cache. */
  public delete(uuid: string): void {
    if (this._entries.delete(uuid)) {
      this._lru.delete(uuid);
      this._version.update(v => v + 1);
    }
  }

  /** Wyczyść cały cache. */
  public clear(): void {
    this._entries.clear();
    this._lru.clear();
    this._version.update(v => v + 1);
  }

  // ────────────────────────────────────────────────────────────────
  // LRU Eksmisja
  // ────────────────────────────────────────────────────────────────

  private _evictIfNeeded(): void {
    while (this._entries.size > this._maxCacheSize) {
      const oldest = this._lru.evictOldest();
      if (oldest) {
        this._entries.delete(oldest);
      } else {
        break; // Bezpieczeństwo: nie powinno się zdarzyć
      }
    }
  }
}
