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
 * Abstract base class for all orchestrators in the ERP system.
 *
 * Responsibilities:
 * - Manages an `IdentityMapStore` for its aggregate type
 * - Owns a `DataLoader` for intelligent batched fetching
 * - Subscribes to SignalR for real-time aggregate updates
 * - Provides reactive `getViewModel()` / `getSignalViewModel()` for the UI
 * - Delegates command execution and registers jobs with `JobService`
 * - Enforces retry policies and error reporting
 *
 * Subclasses must implement:
 * - `signature` — unique identifier for SignalR events
 * - `config` — orchestrator-specific configuration
 * - `fetchByUuids()` — delegates to the generated API client
 * - `searchByFilters()` — delegates search to the API client
 * - `mapToViewModel()` — transforms DTO + resolved deps → ViewModel
 */
@Injectable()
export abstract class BaseOrchestrator<
  TDto extends HasUuid,
  TViewModel,
  TFilters = unknown,
  TLoadOptions extends LoadOptions = LoadOptions,
> implements OnDestroy {

  // ── Injected services ──
  protected readonly injector = inject(Injector);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly jobService = inject(JobService);
  private readonly _signalrSync = inject(SignalrSyncService);

  // ── Core infrastructure ──
  protected readonly identityMap: IdentityMapStore<TDto>;
  protected readonly dataLoader: DataLoader<TDto>;

  private readonly _errors: WritableSignal<OrchestratorError[]> = signal([]);
  private readonly _isLoading: WritableSignal<boolean> = signal(false);
  private readonly _loadedUuids: WritableSignal<Set<string>> = signal(new Set());

  /** Reactive list of errors from this orchestrator. */
  public readonly errors: Signal<OrchestratorError[]> = this._errors.asReadonly();

  /** Whether any load operation is currently in progress. */
  public readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();

  // ── SignalR subscription ──
  private _signalrSub: Subscription | null = null;
  private readonly _signalrRefreshInFlight = new Set<string>();

  // ────────────────────────────────────────────────────────────────
  // Abstract members — to be implemented by each concrete orchestrator
  // ────────────────────────────────────────────────────────────────

  /** Unique signature for this aggregate, e.g. 'catalog.product'. */
  protected abstract readonly signature: string;

  /** Orchestrator-specific configuration with overridable defaults. */
  protected abstract readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string };

  /** Fetch raw DTOs from the API by UUIDs. */
  protected abstract fetchByUuids(uuids: string[]): Observable<TDto[]>;

  /** Execute a search query and return matching UUIDs. */
  protected abstract searchByFilters(filters: TFilters): Observable<SharedSearchResponse>;

  /**
   * Transform a raw DTO into a rich ViewModel.
   * `resolvedDeps` contains eagerly-loaded related aggregates.
   */
  protected abstract mapToViewModel(dto: TDto, resolvedDeps: ResolvedDeps): TViewModel;

  // ────────────────────────────────────────────────────────────────
  // Constructor
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
  // Configuration
  // ────────────────────────────────────────────────────────────────

  /** Merge concrete orchestrator config with defaults. */
  private _getConfig(): OrchestratorConfig {
    return {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...this.orchestratorConfig,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Public API: Data Loading
  // ────────────────────────────────────────────────────────────────

  /**
   * Load aggregates by UUID, with optional eager loading of related aggregates.
   *
   * This is the primary entry point for components. It:
   * 1. Delegates to `DataLoader` for intelligent batched fetching
   * 2. Optionally loads related aggregates (dependency tree)
   * 3. Updates the loaded UUIDs set for `getViewModel()`
   */
  public async loadAsync(uuids: string[], options?: TLoadOptions): Promise<void> {
    if (uuids.length === 0) return;

    this._isLoading.set(true);

    try {
      // Load primary aggregates
      await this.dataLoader.loadAsync(uuids);

      // Eager load dependencies if options are provided
      if (options) {
        await this.resolveEagerDependencies(uuids, options);
      }

      // Track loaded UUIDs for reactive view
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
   * Execute a search query and return matching UUIDs.
   * Optionally auto-loads the found aggregates.
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
  // Public API: Reactive ViewModels
  // ────────────────────────────────────────────────────────────────

  /**
   * Reactive `Signal<Map<uuid, TViewModel>>` for the UI.
   *
   * Returns a computed signal that automatically re-evaluates when
   * underlying DTOs change. Suitable for list views where the entire
   * Map is consumed.
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
   * `Map<uuid, Signal<TViewModel>>` for per-item reactivity.
   *
   * Each entry has its own Signal, so changing one aggregate
   * does NOT cause re-renders for the entire list.
   * Ideal for table rows.
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
   * Get a single ViewModel by UUID as a reactive Signal.
   */
  public getOne(uuid: string): Signal<TViewModel | undefined> {
    return computed(() => {
      const dto = this.identityMap.get(uuid)();
      if (!dto) return undefined;
      return this.mapToViewModel(dto, this._resolveCurrentDeps(dto));
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Public API: Command Execution
  // ────────────────────────────────────────────────────────────────

  /**
   * Execute a command via the API and register the returned job UUID.
   *
   * All commands are delegation-only — the API returns a `jobUuid`
   * that is tracked in `JobService`.
   *
   * @param commandName Human-readable command name for tracking
   * @param apiCall Function that calls the API and returns Observable<string> (jobUuid)
   * @param aggregateUuid Optional UUID of the affected aggregate
   * @returns The job UUID
   */
  public async executeCommand(
    commandName: string,
    apiCall: () => Observable<string>,
    aggregateUuid?: string,
  ): Promise<string> {
    try {
      const jobUuid = await firstValueFrom(apiCall());

      const meta: JobMeta = {
        commandName,
        aggregateUuid,
        timestamp: new Date(),
      };

      this.jobService.addJob(jobUuid, meta);

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
  // Protected: Dependency Resolution (override in subclasses)
  // ────────────────────────────────────────────────────────────────

  /**
   * Override to eagerly load related aggregates when `loadAsync` is
   * called with options.
   *
   * Example: CatalogProductOrchestrator overrides this to load
   * categories and models referenced by the product DTOs.
   */
  protected async resolveEagerDependencies(
    _uuids: string[],
    _options: TLoadOptions,
  ): Promise<void> {
    // Default: no eager loading. Subclasses override.
  }

  /**
   * Override to resolve current dependencies for ViewModel mapping.
   * Called synchronously during `computed()` evaluation.
   *
   * Returns cached/already-loaded dependency data for the given DTO.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _resolveCurrentDeps(_dto: TDto): ResolvedDeps {
    // Default: empty deps. Subclasses override.
    return {};
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: SignalR Real-time Updates
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
    // Only refresh aggregates that are currently in our cache
    const cachedUuids = uuids.filter(uuid => this.identityMap.has(uuid));
    if (cachedUuids.length === 0) return;

    // Prevent duplicate refresh attempts
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
      // Do NOT retry endlessly — error is logged, no infinite loop
    } finally {
      for (const uuid of toRefresh) {
        this._signalrRefreshInFlight.delete(uuid);
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: Error Management
  // ────────────────────────────────────────────────────────────────

  private _addError(error: OrchestratorError): void {
    console.error(`[${this.signature}]`, error.operation, error.message);
    this._errors.update(errors => [...errors.slice(-49), error]); // Keep last 50
  }

  /** Clear all tracked errors. */
  public clearErrors(): void {
    this._errors.set([]);
  }

  // ────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────

  public ngOnDestroy(): void {
    this._signalrSub?.unsubscribe();
    this.dataLoader.destroy();
    this.identityMap.clear();
  }
}
