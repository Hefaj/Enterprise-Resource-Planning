import { Subject, firstValueFrom, Observable } from 'rxjs';
import { bufferTime, filter, retry, take } from 'rxjs/operators';
import { IdentityMapStore } from './identity-map.store';
import { HasUuid, OrchestratorConfig } from './orchestrator.types';

/**
 * Inteligentny menedżer żądań, który służy jako serce systemu pobierania danych.
 *
 * Implementuje wielowarstwowy potok optymalizacyjny:
 * 1. **Dedupikacja** — usuwa duplikaty UUID z kolejki żądań
 * 2. **Sprawdzanie cache** — pomija UUID, które już istnieją w IdentityMapStore
 * 3. **Śledzenie żądań w toku (in-flight tracking)** — zapobiega duplikowaniu zapytań o to samo UUID
 * 4. **Grupowanie czasowe (temporal batching)** — zbiera pojedyncze wywołania w paczki za pomocą `bufferTime`
 * 5. **Dzielenie na części (chunking)** — dzieli duże paczki na części o skonfigurowanym rozmiarze
 * 6. **Ponawianie z wycofaniem (retry with backoff)** — wykładnicze wycofywanie się w przypadku przejściowych awarii
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
  // Publiczne API
  // ────────────────────────────────────────────────────────────────

  /**
   * Zażądaj załadowania jednego lub więcej agregatów po UUID.
   *
   * Ta metoda jest zaprojektowana do częstego wywoływania z wielu komponentów.
   * Wywołania są automatycznie grupowane, dedupikowane i optymalizowane.
   *
   * Zwraca Promise, który rozwiązuje się, gdy WSZYSTKIE żądane UUID są dostępne
   * w IdentityMapStore (pochodzące z cache lub nowo pobrane).
   */
  public async loadAsync(uuids: string[]): Promise<void> {
    if (uuids.length === 0) return;

    // Krok 1: Deduplikacja
    const unique = [...new Set(uuids)];

    // Krok 2: Odfiltruj już zapamiętane UUID
    const missing = this._identityMap.getMissing(unique);
    if (missing.length === 0) return;

    // Krok 3: Odfiltruj UUID, których pobieranie jest w toku, ale zachowaj ich obietnice (Promises)
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

    // Krok 4: Umieść nowe UUID w kolejce potoku buforowego
    let newPromise: Promise<void> | undefined;

    if (toFetch.length > 0) {
      newPromise = new Promise<void>((resolve, reject) => {
        this._bufferSubject.next({ uuids: toFetch, resolve, reject });
      });

      // Zarejestruj oczekujące obietnice dla wszystkich nowych UUID
      for (const uuid of toFetch) {
        this._pendingRequests.set(uuid, newPromise);
      }
    }

    // Czekaj na wszystkie — zarówno te w toku, jak i nowo zakolejkowane
    const allPromises = [...existingPromises];
    if (newPromise) {
      allPromises.push(newPromise);
    }

    await Promise.all(allPromises);
  }

  /**
   * Wymuś przeładowanie określonych UUID, pomijając sprawdzanie cache.
   * Używane przez odświeżanie SignalR do aktualizacji nieaktualnych danych.
   */
  public async reloadAsync(uuids: string[]): Promise<void> {
    if (uuids.length === 0) return;

    const unique = [...new Set(uuids)];
    const chunks = this._chunkArray(unique, this._config.maxChunkSize);

    await Promise.all(chunks.map(chunk => this._fetchChunkWithRetry(chunk)));
  }

  /**
   * Wyczyść zasoby.
   */
  public destroy(): void {
    this._bufferSubject.complete();
  }

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: Potok buforowy (Buffer Pipeline)
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
    // Połącz wszystkie UUID z paczki i ponownie je zdedupikuj
    const allUuids = new Set<string>();
    for (const request of batch) {
      for (const uuid of request.uuids) {
        allUuids.add(uuid);
      }
    }

    // Ostateczne sprawdzenie cache (niektóre mogły zostać załadowane przez współbieżną paczkę)
    const missing = this._identityMap.getMissing([...allUuids]);

    if (missing.length === 0) {
      // Wszystko jest w cache — rozwiąż wszystkie obietnice
      for (const request of batch) {
        request.resolve();
      }
      this._cleanPending([...allUuids]);
      return;
    }

    // Podziel na części i pobierz
    const chunks = this._chunkArray(missing, this._config.maxChunkSize);

    try {
      await Promise.all(chunks.map(chunk => this._fetchChunkWithRetry(chunk)));

      // Wszystko się udało — rozwiąż wszystkie obietnice z paczki
      for (const request of batch) {
        request.resolve();
      }
    } catch (err) {
      // Jeśli którakolwiek część zawiedzie po ponowieniach, odrzuć wszystkie obietnice z paczki
      for (const request of batch) {
        request.reject(err);
      }
    } finally {
      this._cleanPending([...allUuids]);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: Pobieranie z ponawianiem (Fetch with Retry)
  // ────────────────────────────────────────────────────────────────

  private async _fetchChunkWithRetry(uuids: string[]): Promise<void> {
    const source$ = this._fetchFn(uuids).pipe(
      retry({
        count: this._config.maxRetries,
        delay: (_error, retryIndex) => {
          const delayMs = this._config.retryDelayMs * Math.pow(2, retryIndex - 1);
          console.warn(
            `[DataLoader] Ponowienie ${retryIndex}/${this._config.maxRetries} po ${delayMs}ms`,
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
  // Wewnętrzne: Narzędzia
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
// Typy Wewnętrzne
// ────────────────────────────────────────────────────────────────

interface LoadRequest {
  uuids: string[];
  resolve: () => void;
  reject: (err: unknown) => void;
}
