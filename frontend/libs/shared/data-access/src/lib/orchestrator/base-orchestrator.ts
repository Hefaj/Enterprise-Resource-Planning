import {
  inject,
  signal,
  computed,
  Signal,
  OnDestroy,
  DestroyRef,
  Injector,
  WritableSignal,
  Injectable,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { IdentityMapStore } from './identity-map.store';
import { DataLoader } from './data-loader';
import { JobService } from './job.service';
import { SignalrSyncService } from '../sync/signalr-sync.service';
import { withRequestId } from '../sync/request-id';
import { ErpOptimisticStore } from '../optimistic/optimistic.store';
import {
  HasUuid,
  OrchestratorConfig,
  OrchestratorError,
  LoadOptions,
  DEFAULT_ORCHESTRATOR_CONFIG,
  ResolvedDeps,
  SharedSearchResponse,
  CommandOptions,
  ErpBatchPayload,
  ErpBatchResult,
  JobMeta,
  Translatable,
} from './orchestrator.types';

/**
 * Abstrakcyjna klasa bazowa dla wszystkich orkiestratorów w systemie ERP.
 *
 * Odpowiedzialności:
 * - Zarządza `IdentityMapStore` dla swojego typu agregatu
 * - Posiada `DataLoader` dla inteligentnego pobierania paczek danych
 * - Subskrybuje SignalR dla aktualizacji agregatów w czasie rzeczywistym
 * - Zapewnia reaktywne metody `getViewModel()` / `getSignalViewModel()` dla UI
 * - Deleguje wykonywanie poleceń (commands) i rejestruje zadania (jobs) w `JobService`
 * - Wymusza polityki ponawiania i raportowania błędów
 *
 * Klasy potomne muszą zaimplementować:
 * - `signature` — unikalny identyfikator dla zdarzeń SignalR
 * - `config` — specyficzna konfiguracja orkiestratora
 * - `fetchByUuids()` — deleguje do wygenerowanego klienta API
 * - `searchByFilters()` — deleguje wyszukiwanie do klienta API
 * - `mapToViewModel()` — transformuje DTO + rozwiązane zależności → ViewModel
 */
@Injectable()
export abstract class BaseOrchestrator<
  TDto extends HasUuid,
  TViewModel,
  TFilters = unknown,
  TLoadOptions extends LoadOptions = LoadOptions,
> implements OnDestroy {

  // ── Wstrzykiwane serwisy ──
  protected readonly injector = inject(Injector);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly jobService = inject(JobService);
  private readonly _signalrSync = inject(SignalrSyncService);
  private readonly _optimistic = inject(ErpOptimisticStore);

  // ── Podstawowa infrastruktura ──
  protected readonly identityMap: IdentityMapStore<TDto>;
  protected readonly dataLoader: DataLoader<TDto>;

  private readonly _errors: WritableSignal<OrchestratorError[]> = signal([]);
  private readonly _isLoading: WritableSignal<boolean> = signal(false);
  private readonly _loadedUuids: WritableSignal<Set<string>> = signal(new Set());

  /** Reaktywna lista błędów z tego orkiestratora. */
  public readonly errors: Signal<OrchestratorError[]> = this._errors.asReadonly();

  /** Czy jakakolwiek operacja ładowania jest obecnie w toku. */
  public readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();

  // ── Subskrypcja SignalR ──
  private _signalrSub: Subscription | null = null;
  private _signalrSignature: string | null = null;
  private readonly _signalrRefreshInFlight = new Set<string>();

  private readonly _signalVmCache = new Map<string, Signal<TViewModel>>();

  // ────────────────────────────────────────────────────────────────
  // Elementy abstrakcyjne — do zaimplementowania w klasach potomnych
  // ────────────────────────────────────────────────────────────────

  /** Unikalny podpis dla tego agregatu, np. 'catalog.product'. */
  protected abstract readonly signature: string;

  /** Specyficzna konfiguracja orkiestratora z możliwością nadpisania domyślnych wartości. */
  protected abstract readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string };

  /** Pobierz surowe obiekty DTO z API za pomocą identyfikatorów UUID. */
  protected abstract fetchByUuids(uuids: string[]): Observable<TDto[]>;

  /** Wykonaj zapytanie wyszukiwania i zwróć pasujące identyfikatory UUID. */
  protected abstract searchByFilters(filters: TFilters): Observable<SharedSearchResponse>;

  /**
   * Przekształć surowy obiekt DTO w bogaty ViewModel.
   * `resolvedDeps` zawiera eagerly-loaded (natychmiast załadowane) powiązane agregaty.
   */
  protected abstract mapToViewModel(dto: TDto, resolvedDeps: ResolvedDeps): TViewModel;

  // ────────────────────────────────────────────────────────────────
  // Konstruktor
  // ────────────────────────────────────────────────────────────────

  public constructor() {
    const cfg = this._getConfig();

    this.identityMap = new IdentityMapStore<TDto>(cfg.maxCacheSize);
    this.dataLoader = new DataLoader<TDto>(
      (uuids) => this.fetchByUuids(uuids),
      this.identityMap,
      cfg,
    );

    this._initSignalR(cfg.signalrSignature);
  }

  // ────────────────────────────────────────────────────────────────
  // Konfiguracja
  // ────────────────────────────────────────────────────────────────

  /** Połącz konfigurację konkretnego orkiestratora z wartościami domyślnymi. */
  private _getConfig(): OrchestratorConfig {
    return {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...this.orchestratorConfig,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Publiczne API: Ładowanie Danych
  // ────────────────────────────────────────────────────────────────

  /**
   * Ładowanie agregatów po UUID, z opcjonalnym eager loading (natychmiastowym ładowaniem) powiązanych agregatów.
   *
   * To jest główny punkt wejścia dla komponentów. Wykonuje:
   * 1. Deleguje do `DataLoader` dla inteligentnego pobierania paczek danych
   * 2. Opcjonalnie ładuje powiązane agregaty (drzewo zależności)
   * 3. Aktualizuje zestaw załadowanych UUID dla `getViewModel()`
   */
  public async loadAsync(uuids: string[], options?: TLoadOptions): Promise<void> {
    if (uuids.length === 0) return;

    this._isLoading.set(true);

    try {
      // Pobierz główne agregaty
      await this.dataLoader.loadAsync(uuids);

      // Eager load zależności, jeśli przekazano opcje
      if (options) {
        await this.resolveEagerDependencies(uuids, options);
      }

      // Śledź załadowane UUID dla widoku reaktywnego
      this._loadedUuids.update(set => {
        const updated = new Set(set);
        for (const uuid of uuids) {
          updated.add(uuid);
        }
        return updated;
      });
    } catch (err) {
      this.addError({
        operation: 'load',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Wykonaj zapytanie wyszukiwania i zwróć pasujące identyfikatory UUID.
   * Opcjonalnie automatycznie ładuje znalezione agregaty.
   */
  public async searchAsync(
    filters: TFilters,
    options?: { autoLoad?: boolean; loadOptions?: TLoadOptions },
  ): Promise<SharedSearchResponse> {
    try {
      const response = await firstValueFrom(this.searchByFilters(filters));
      const uuids = response.uuids ?? [];

      if (options?.autoLoad !== false && uuids.length > 0) {
        await this.loadAsync(uuids, options?.loadOptions);
      }

      return response;
    } catch (err) {
      this.addError({
        operation: 'search',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Publiczne API: Reaktywne ViewModels
  // ────────────────────────────────────────────────────────────────

  /**
   * Reaktywny `Signal<Map<uuid, TViewModel>>` dla UI.
   *
   * Zwraca obliczony sygnał (computed), który automatycznie przelicza się, gdy
   * bazowe obiekty DTO ulegną zmianie. Odpowiedni dla widoków listowych, gdzie
   * cała mapa jest konsumowana.
   */
  public getViewModel(): Signal<Map<string, TViewModel>> {
    return computed(() => {
      const loaded = this._loadedUuids();
      const result = new Map<string, TViewModel>();

      for (const uuid of loaded) {
        const dto = this._project(uuid, this.identityMap.peek(uuid));
        if (dto) {
          result.set(uuid, this.mapToViewModel(dto, this._resolveCurrentDeps(dto)));
        }
      }

      return result;
    });
  }

  /**
   * `Map<uuid, Signal<TViewModel>>` dla reaktywności na poziomie pojedynczego elementu.
   *
   * Każdy wpis ma swój własny Signal, więc zmiana jednego agregatu
   * NIE powoduje ponownego renderowania dla całej listy.
   * Idealne dla wierszy tabeli.
   */
  public getSignalViewModel(): Map<string, Signal<TViewModel>> {
    const loaded = this._loadedUuids();
    const result = new Map<string, Signal<TViewModel>>();

    for (const uuid of loaded) {
      let vmSignal = this._signalVmCache.get(uuid);
      if (!vmSignal) {
        const dtoSignal = this.identityMap.get(uuid);
        vmSignal = computed(() => {
          const dto = this._project(uuid, dtoSignal());
          if (!dto) {
            return undefined as unknown as TViewModel;
          }
          return this.mapToViewModel(dto, this._resolveCurrentDeps(dto));
        });
        this._signalVmCache.set(uuid, vmSignal);
      }
      result.set(uuid, vmSignal);
    }

    return result;
  }

  /**
   * Pobierz pojedynczy ViewModel po UUID jako reaktywny Signal.
   */
  public getOne(uuid: string): Signal<TViewModel | undefined> {
    return computed(() => {
      const dto = this._project(uuid, this.identityMap.get(uuid)());
      if (!dto) return undefined;
      return this.mapToViewModel(dto, this._resolveCurrentDeps(dto));
    });
  }

  /**
   * Nakłada nakładkę optymistyczną aktywną dla tego uuid na `dto` — wołane tuż przed
   * `mapToViewModel(...)` w każdym z trzech miejsc wyżej, jedynych, przez które DTO trafia do UI.
   * Czyste i tanie (deleguje do `ErpOptimisticStore.project`), bezpieczne wewnątrz `computed()`.
   */
  private _project(uuid: string, dto: TDto | undefined): TDto | undefined {
    return this._optimistic.project<TDto>(this.orchestratorConfig.signalrSignature, uuid, dto);
  }

  // ────────────────────────────────────────────────────────────────
  // Protected: Rozwiązywanie Zależności (do nadpisania w klasach potomnych)
  // ────────────────────────────────────────────────────────────────

  /**
   * Nadpisz, aby natychmiast ładować (eager load) powiązane agregaty, gdy `loadAsync`
   * jest wywoływany z opcjami.
   *
   * Przykład: CatalogProductOrchestrator nadpisuje tę metodę, aby ładować
   * kategorie i modele powiązane przez produktowe DTO.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  protected async resolveEagerDependencies(
    _uuids: string[],
    _options: TLoadOptions,
  ): Promise<void> {
    // Domyślnie: brak eager loadingu. Nadpisywane w podklasach.
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * Nadpisz, aby rozwiązywać aktualne zależności dla mapowania ViewModel.
   * Wywoływane synchronicznie podczas ewaluacji `computed()`.
   *
   * Zwraca zapisane w cache/już załadowane dane zależności dla danego DTO.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _resolveCurrentDeps(_dto: TDto): ResolvedDeps {
    // Domyślnie: puste zależności. Nadpisywane w podklasach.
    return {};
  }

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: Aktualizacje w czasie rzeczywistym SignalR
  // ────────────────────────────────────────────────────────────────

  private _initSignalR(signature: string): void {
    this._signalrSignature = signature;
    this._signalrSync.subscribe(signature);

    this._signalrSub = this._signalrSync
      .onUpdate(signature)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(uuids => {
        this._handleSignalRUpdate(uuids);
      });

    this._signalrSync
      .onDelete(signature)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(uuids => {
        this._handleSignalRDelete(uuids);
      });

    this._signalrSync
      .onResync(signature)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this._handleFullResync();
      });
  }

  private async _handleSignalRUpdate(uuids: string[]): Promise<void> {
    // Odświeżaj tylko te agregaty, które aktualnie mamy w cache
    const cachedUuids = uuids.filter(uuid => this.identityMap.has(uuid));
    if (cachedUuids.length === 0) return;

    // Zapobiegaj zduplikowanym próbom odświeżenia
    const toRefresh = cachedUuids.filter(uuid => !this._signalrRefreshInFlight.has(uuid));
    if (toRefresh.length === 0) return;

    for (const uuid of toRefresh) {
      this._signalrRefreshInFlight.add(uuid);
    }

    try {
      await this.dataLoader.reloadAsync(toRefresh);
    } catch (err) {
      this.addError({
        operation: 'signalr-refresh',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      // NIE ponawiaj w nieskończoność — błąd jest logowany, brak pętli nieskończonej
    } finally {
      for (const uuid of toRefresh) {
        this._signalrRefreshInFlight.delete(uuid);
      }
    }
  }

  /** Usuwa zdalnie skasowane agregaty z cache — z `identityMap`, ze zbioru załadowanych
   * UUID i z cache sygnałów per-wiersz, żeby nie trzymać martwych referencji. */
  private _handleSignalRDelete(uuids: string[]): void {
    const relevant = uuids.filter(uuid => this._loadedUuids().has(uuid) || this.identityMap.has(uuid));
    if (relevant.length === 0) return;

    for (const uuid of relevant) {
      this.identityMap.delete(uuid);
      this._signalVmCache.delete(uuid);
    }

    this._loadedUuids.update(set => {
      const updated = new Set(set);
      for (const uuid of relevant) {
        updated.delete(uuid);
      }
      return updated;
    });
  }

  /**
   * Porzuca cały cache tej sygnatury i przeładowuje to, co orkiestrator ma aktualnie
   * załadowane — wywoływane na `ReceiveResync` (luka po rozłączeniu) i na
   * `ReceiveInvalidation(signature, 'all')` (masowa zmiana powyżej progu koalescencji).
   * Brak buforowanej historii zdarzeń, więc jedyna uczciwa reakcja to pełny reload,
   * nie próba częściowego dogonienia.
   */
  private async _handleFullResync(): Promise<void> {
    const currentlyLoaded = [...this._loadedUuids()];
    if (currentlyLoaded.length === 0) return;

    this.identityMap.clear();
    this._signalVmCache.clear();

    try {
      await this.dataLoader.reloadAsync(currentlyLoaded);
    } catch (err) {
      this.addError({
        operation: 'signalr-resync',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
    }
  }


  // ────────────────────────────────────────────────────────────────
  // Komendy (mutacje)
  // ────────────────────────────────────────────────────────────────
  //
  // Każda ścieżka zapisu w systemie ma ten sam obrys: identyfikator operacji (`X-Request-Id`,
  // czyli klucz idempotencji backendu) → metadane dla feedu powiadomień doklejone do żądania →
  // rejestracja zadania w `JobService` → zamiana błędu HTTP na wpis w stanie orkiestratora.
  // Różni się wyłącznie payload, dlatego obrys mieszka tutaj, a nie w każdym orkiestratorze
  // z osobna. Metody są `protected`: publiczne API komend to nazwane metody agregatu
  // (`setPriceMultipleAsync`), nie generyczny „wyślij cokolwiek”.

  /**
   * Zleca operację masową i zwraca `jobUuid`.
   *
   * Payload przekazujesz w kształcie, jakiego oczekuje endpoint (`{ commands: [...] }` albo
   * `{ templateCommand, targetUuids | targetFilter }`) — `queueId` i `uiMetadata` dokłada
   * ta metoda, żeby żaden orkiestrator nie musiał pamiętać o serializacji metadanych.
   *
   * Metadane jadą RAZEM z komendą, nie tylko do lokalnego `JobService`: backend przechowuje je
   * przy zadaniu i oddaje w `JobDto.uiMetadata`, dzięki czemu opis („Zmiana ceny”) przeżywa
   * odświeżenie strony i jest widoczny na innej karcie.
   */
  protected async runBatchCommandAsync<TPayload extends ErpBatchPayload>(
    call: (payload: TPayload) => Observable<ErpBatchResult>,
    payload: TPayload,
    options: CommandOptions,
  ): Promise<string> {
    const meta: JobMeta = {
      commandName: options.commandName,
      aggregateUuid: options.aggregateUuid,
      notifyOnComplete: options.notifyOnComplete,
      timestamp: new Date(),
    };

    const result = await this.runDirectCommandAsync(() =>
      call({ ...payload, queueId: options.queueId, uiMetadata: JSON.stringify(meta) }),
    );
    const jobUuid = result.jobUuid || '';

    this.jobService.addJob(jobUuid, options.queueId, meta);

    return jobUuid;
  }

  /**
   * Zleca operację masową na JEDNYM znanym celu — cukier na {@link runBatchCommandAsync}.
   *
   * Nawet wywołanie na jednym agregacie jest zadaniem z jednym elementem: endpointy zapisu
   * idą przez `BatchEndpointBase` i innego trybu nie mają. `aggregateUuid` do metadanych
   * bierzemy z `command.uuid`, chyba że wywołujący poda go jawnie w `options`.
   */
  protected runSingleCommandAsync<TCommand extends { uuid?: string }>(
    call: (payload: { commands: TCommand[] } & ErpBatchPayload) => Observable<ErpBatchResult>,
    command: TCommand,
    options: CommandOptions,
  ): Promise<string> {
    return this.runBatchCommandAsync(call, { commands: [command] }, {
      ...options,
      aggregateUuid: options.aggregateUuid ?? command.uuid,
    });
  }

  /**
   * Komenda, która NIE tworzy zadania masowego — zwraca swój wynik od razu (np. rejestracja
   * wgranych plików oddająca uuidy zasobów).
   *
   * Daje to samo, co dwie metody wyżej, minus `JobService`: zakres `X-Request-Id` i zamianę
   * błędu HTTP na wpis w `errors`. Błąd zawsze leci dalej — o tym, czy pokazać go użytkownikowi,
   * decyduje wywołujący w `feature`, nie orkiestrator.
   */
  protected async runDirectCommandAsync<TResult>(call: () => Observable<TResult>): Promise<TResult> {
    try {
      // withRequestId owija SAMO wywołanie API: zakres trzyma identyfikator przez synchroniczne
      // wykonanie, czyli dokładnie tyle, ile trzeba, by interceptor dokleił nagłówek.
      return await withRequestId(() => firstValueFrom(call()));
    } catch (err) {
      this.addError({
        operation: 'command',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Nakładki optymistyczne — patrz `docs/guides/frontend/optimistic-updates.md`
  // ────────────────────────────────────────────────────────────────

  /**
   * Uruchamia komendę mutującą JEDEN agregat z natychmiastowym, optymistycznym skutkiem —
   * cukier łączący {@link ErpOptimisticStore.runAsync} z cache’m tego orkiestratora.
   *
   * <p>Przypina uuid w {@link identityMap} na czas trwania nakładki (patrz
   * `IdentityMapStore.pin`) — bez tego wpis mógłby wypaść z LRU zanim nakładka zdąży się zdjąć,
   * a wtedy nie miałaby już czego patchować. Odpina zawsze, także po cichym timeout-cie.</p>
   *
   * <p>`settleAsync` jest zawsze wymuszonym przeładowaniem TEGO agregatu — jedyny sensowny
   * refetch po własnej mutacji agregatu, więc wywołujący go nie podaje.</p>
   */
  protected async runOptimisticCommandAsync(
    uuid: string,
    patch: (current: TDto | undefined) => TDto | undefined,
    dispatchAsync: () => Promise<string>,
    options?: { onRollback?: () => void; failureMessage?: Translatable },
  ): Promise<void> {
    this.identityMap.pin(uuid);

    try {
      await this._optimistic.runAsync<TDto>({
        scope: this.orchestratorConfig.signalrSignature,
        key: uuid,
        patch,
        dispatchAsync,
        settleAsync: () => this.dataLoader.reloadAsync([uuid]),
        onRollback: options?.onRollback,
        failureMessage: options?.failureMessage,
      });
    } finally {
      this.identityMap.unpin(uuid);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: Zarządzanie Błędami
  // ────────────────────────────────────────────────────────────────

  protected addError(error: OrchestratorError): void {
    console.error(`[${this.signature}]`, error.operation, error.message);
    this._errors.update(errors => [...errors.slice(-49), error]); // Zachowaj ostatnie 50
  }

  /** Wyczyść wszystkie śledzone błędy. */
  public clearErrors(): void {
    this._errors.set([]);
  }

  // ────────────────────────────────────────────────────────────────
  // Cykl Życia (Lifecycle)
  // ────────────────────────────────────────────────────────────────

  public ngOnDestroy(): void {
    this._signalrSub?.unsubscribe();
    if (this._signalrSignature) {
      this._signalrSync.unsubscribe(this._signalrSignature);
    }
    this.dataLoader.destroy();
    this.identityMap.clear();
    this._signalVmCache.clear();
  }
}
