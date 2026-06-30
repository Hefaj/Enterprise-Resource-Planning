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
import {
  HasUuid,
  OrchestratorConfig,
  OrchestratorError,
  LoadOptions,
  Pagination,
  JobMeta,
  DEFAULT_ORCHESTRATOR_CONFIG,
  ResolvedDeps,
  SharedSearchResponse,
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
  private readonly _signalrRefreshInFlight = new Set<string>();

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
      this._addError({
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
      this._addError({
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
        const dto = this.identityMap.peek(uuid);
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
      const dtoSignal = this.identityMap.get(uuid);
      result.set(
        uuid,
        computed(() => {
          const dto = dtoSignal();
          if (!dto) {
            return undefined as unknown as TViewModel;
          }
          return this.mapToViewModel(dto, this._resolveCurrentDeps(dto));
        }),
      );
    }

    return result;
  }

  /**
   * Pobierz pojedynczy ViewModel po UUID jako reaktywny Signal.
   */
  public getOne(uuid: string): Signal<TViewModel | undefined> {
    return computed(() => {
      const dto = this.identityMap.get(uuid)();
      if (!dto) return undefined;
      return this.mapToViewModel(dto, this._resolveCurrentDeps(dto));
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Publiczne API: Wykonywanie Poleceń (Commands)
  // ────────────────────────────────────────────────────────────────

  /**
   * Wykonaj polecenie (command) przez API i zarejestruj zwrócony identyfikator UUID zadania (job).
   *
   * Wszystkie polecenia działają na zasadzie delegacji — API zwraca `jobUuid`,
   * który jest śledzony w `JobService`.
   *
   * @param commandName Czytelna dla człowieka nazwa polecenia do śledzenia
   * @param apiCall Funkcja wywołująca API i zwracająca Observable<string> (jobUuid)
   * @param aggregateUuid Opcjonalny identyfikator UUID powiązanego agregatu
   * @param queueID Opcjonalny identyfikator pochodnego modalu (identyfikator kolejki)
   * @returns Identyfikator UUID zadania (job)
   */
  public async executeCommand(
    commandName: string,
    apiCall: () => Observable<string>,
    aggregateUuid?: string,
    queueID?: string,
  ): Promise<string> {
    try {
      const jobUuid = await firstValueFrom(apiCall());

      const meta: JobMeta = {
        commandName,
        aggregateUuid,
        timestamp: new Date(),
      };

      this.jobService.addJob(jobUuid, queueID, meta);

      return jobUuid;
    } catch (err) {
      this._addError({
        operation: 'command',
        uuid: aggregateUuid,
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    }
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
  protected async resolveEagerDependencies(
    _uuids: string[],
    _options: TLoadOptions,
  ): Promise<void> {
    // Domyślnie: brak eager loadingu. Nadpisywane w podklasach.
  }

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
    this._signalrSub = this._signalrSync
      .onUpdate(signature)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(uuids => {
        this._handleSignalRUpdate(uuids);
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
      this._addError({
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

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: Zarządzanie Błędami
  // ────────────────────────────────────────────────────────────────

  private _addError(error: OrchestratorError): void {
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
    this.dataLoader.destroy();
    this.identityMap.clear();
  }
}
