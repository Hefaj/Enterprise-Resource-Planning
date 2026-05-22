import { inject, DestroyRef, computed, Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, forkJoin, Subject, ReplaySubject } from 'rxjs';
import { bufferTime, filter, map, switchMap, tap, finalize } from 'rxjs/operators';
import { SignalrSyncService } from '../sync/signalr-sync.service';
import { AggregateStore } from './aggregate-store';

export interface BaseDto {
  uuid: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Internal request structure used to batch load calls.
 */
interface LoadRequest<TOptions> {
  uuid: string;
  options?: TOptions;
  resolve: (uuid: string) => void;
}

/** Default buffer time in milliseconds for aggregating load requests. */
const LOAD_BUFFER_TIME_MS = 50;

export abstract class BaseOrchestrator<
  TDto extends BaseDto,
  TViewModel,
  TFilters = unknown,
  TOptions = unknown
> {
  protected get signature(): string {
    return '';
  }

  protected readonly store: AggregateStore = inject(AggregateStore);

  /**
   * Internal reactive cache of raw DTOs retrieved from backend queries.
   * Stored in the universal AggregateStore to allow decoupled data queries.
   */
  protected readonly cacheSignal: WritableSignal<Map<string, TDto>> =
    this.store.getCacheSignal<TDto>(this.signature);

  /**
   * Computes a reactive map of all view models stored in the cache.
   * Because it executes in a computed context, reading other orchestrators' signals
   * automatically links them, propagating changes reactively down the dependency graph.
   */
  public readonly allViewModels: Signal<Map<string, TViewModel>> = computed((): Map<string, TViewModel> => {
    const map = new Map<string, TViewModel>();
    const dtos = this.cacheSignal();
    for (const [uuid, dto] of dtos) {
      map.set(uuid, this.enrich(dto));
    }
    return map;
  });

  protected readonly syncService: SignalrSyncService = inject(SignalrSyncService);
  protected readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Set of UUIDs currently being fetched from the backend.
   * Used to prevent duplicate API calls for the same UUID.
   */
  private readonly _pendingUuids = new Set<string>();

  /**
   * Map of UUIDs currently in-flight to a ReplaySubject that resolves
   * when the UUID data is available. Callers requesting an in-flight UUID
   * subscribe to this subject instead of triggering a new request.
   */
  private readonly _inFlightNotifiers = new Map<string, ReplaySubject<string>>();

  /**
   * Subject that collects individual load requests and batches them
   * using bufferTime for efficient API calls.
   */
  private readonly _loadSubject = new Subject<LoadRequest<TOptions>>();

  public constructor() {
    this.store.register(this.signature, this);
    this._initializeRealtimeSync();
    this._initializeLoadBuffer();
  }

  /**
   * Subscribe to SignalR changes. If an aggregate signature matches,
   * check if the modified UUIDs are in cache. If so, reload them.
   */
  private _initializeRealtimeSync(): void {
    console.log(`[BaseOrchestrator - ${this.signature}] Subscribing to sync events...`);
    this.syncService.onUpdate(this.signature)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uuids: string[]) => {
          const currentCache = this.cacheSignal();
          console.log(`[BaseOrchestrator - ${this.signature}] Received sync event:`, uuids, 'Cache has:', Array.from(currentCache.keys()));
          const toReload = uuids.filter(id => currentCache.has(id));
          if (toReload.length > 0) {
            console.log(`[BaseOrchestrator - ${this.signature}] Reloading modified UUIDs:`, toReload);
            this._forceLoad(toReload).subscribe();
          }
        },
        error: (err: unknown) => console.error(`[BaseOrchestrator - ${this.signature}] Sync error:`, err),
        complete: () => console.log(`[BaseOrchestrator - ${this.signature}] Sync subscription completed.`)
      });
  }

  /**
   * Initialize the internal load buffer that aggregates incoming UUID requests
   * using bufferTime, deduplicates them, and performs a single batched API call.
   */
  private _initializeLoadBuffer(): void {
    this._loadSubject.pipe(
      bufferTime(LOAD_BUFFER_TIME_MS),
      filter(batch => batch.length > 0),
      switchMap(batch => {
        // Deduplicate UUIDs within the batch
        const uniqueUuids = Array.from(new Set(batch.map(r => r.uuid)));

        // Determine the merged options from all requests in the batch (take the first non-undefined)
        const mergedOptions = batch.find(r => r.options !== undefined)?.options;

        // Mark UUIDs as pending
        for (const uuid of uniqueUuids) {
          this._pendingUuids.add(uuid);
        }

        return this.fetchData(uniqueUuids).pipe(
          tap(dtos => this.updateCache(dtos)),
          switchMap(dtos => {
            const depLoads = this.resolveDependencies(dtos, mergedOptions);
            if (depLoads.length > 0) {
              return forkJoin(depLoads).pipe(map(() => uniqueUuids));
            }
            return of(uniqueUuids);
          }),
          finalize(() => {
            // Remove from pending and notify all waiters
            for (const uuid of uniqueUuids) {
              this._pendingUuids.delete(uuid);
              const notifier = this._inFlightNotifiers.get(uuid);
              if (notifier) {
                notifier.next(uuid);
                notifier.complete();
                this._inFlightNotifiers.delete(uuid);
              }
            }
          }),
          // Notify individual request resolvers
          tap(() => {
            for (const request of batch) {
              request.resolve(request.uuid);
            }
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      error: (err: unknown) => console.error(`[BaseOrchestrator - ${this.signature}] Load buffer error:`, err)
    });
  }

  /**
   * Run a search query using the provided filters. Returns a list of UUIDs.
   */
  public search(filters: TFilters): Observable<string[]> {
    return this.fetchSearch(filters);
  }

  /**
   * Loads specific aggregates by their UUIDs.
   * - Skips UUIDs already present in cache.
   * - Skips UUIDs currently being fetched (in-flight), but waits for them.
   * - Aggregates remaining UUIDs into a buffered batch via bufferTime.
   *
   * Returns an Observable that resolves when ALL requested UUIDs
   * (cached, in-flight, and newly fetched) are available.
   */
  public load(uuids: string[], options?: TOptions): Observable<TViewModel[]> {
    if (!uuids || uuids.length === 0) {
      return of([]);
    }

    const cachedUuids: string[] = [];
    const inFlightUuids: string[] = [];
    const toFetchUuids: string[] = [];

    const currentCache = this.cacheSignal();

    for (const uuid of uuids) {
      if (currentCache.has(uuid)) {
        // Already in cache — no fetch needed
        cachedUuids.push(uuid);
      } else if (this._pendingUuids.has(uuid)) {
        // Currently being fetched — wait for it
        inFlightUuids.push(uuid);
      } else {
        // Needs fetching
        toFetchUuids.push(uuid);
      }
    }

    // Collect all observables we need to wait on
    const waitObservables: Observable<unknown>[] = [];

    // For in-flight UUIDs, subscribe to their existing notifiers
    for (const uuid of inFlightUuids) {
      let notifier = this._inFlightNotifiers.get(uuid);
      if (!notifier) {
        // Edge case: pending but no notifier yet — create one
        notifier = new ReplaySubject<string>(1);
        this._inFlightNotifiers.set(uuid, notifier);
      }
      waitObservables.push(notifier);
    }

    // For UUIDs that need fetching, push them into the buffer and wait
    for (const uuid of toFetchUuids) {
      // Mark as pending immediately so subsequent calls see it
      this._pendingUuids.add(uuid);

      // Create a notifier for this UUID
      const notifier = new ReplaySubject<string>(1);
      this._inFlightNotifiers.set(uuid, notifier);
      waitObservables.push(notifier);

      // Push into the load buffer
      this._loadSubject.next({
        uuid,
        options,
        resolve: () => { /* resolved via notifier */ }
      });
    }

    // If nothing to wait on, return immediately from cache
    if (waitObservables.length === 0) {
      return of(this._mapUuidsToViewModels(uuids));
    }

    // Wait for all in-flight + new fetches to complete, then map
    return forkJoin(waitObservables).pipe(
      map(() => this._mapUuidsToViewModels(uuids))
    );
  }

  /**
   * Force-loads UUIDs bypassing the cache check (used for sync/reload).
   * Still uses buffering to avoid request storms.
   */
  private _forceLoad(uuids: string[]): Observable<TViewModel[]> {
    const waitObservables: Observable<unknown>[] = [];

    for (const uuid of uuids) {
      if (this._pendingUuids.has(uuid)) {
        // Already being fetched — wait for it
        let notifier = this._inFlightNotifiers.get(uuid);
        if (!notifier) {
          notifier = new ReplaySubject<string>(1);
          this._inFlightNotifiers.set(uuid, notifier);
        }
        waitObservables.push(notifier);
      } else {
        this._pendingUuids.add(uuid);
        const notifier = new ReplaySubject<string>(1);
        this._inFlightNotifiers.set(uuid, notifier);
        waitObservables.push(notifier);

        this._loadSubject.next({
          uuid,
          resolve: () => { /* resolved via notifier */ }
        });
      }
    }

    if (waitObservables.length === 0) {
      return of(this._mapUuidsToViewModels(uuids));
    }

    return forkJoin(waitObservables).pipe(
      map(() => this._mapUuidsToViewModels(uuids))
    );
  }

  /**
   * Returns a reactive view model map containing only the requested UUIDs.
   * The returned map signal will automatically trigger updates in your views.
   */
  public getViewModel(uuids: string[]): Signal<Map<string, TViewModel>> {
    return computed((): Map<string, TViewModel> => {
      const all = this.allViewModels();
      const map = new Map<string, TViewModel>();
      for (const uuid of uuids) {
        const vm = all.get(uuid);
        if (vm) {
          map.set(uuid, vm);
        }
      }
      return map;
    });
  }

  /**
   * Update the cache signal safely.
   */
  protected updateCache(dtos: TDto[]): void {
    this.cacheSignal.update(current => {
      const next = new Map(current);
      for (const dto of dtos) {
        next.set(dto.uuid, dto);
      }
      return next;
    });
  }

  private _mapUuidsToViewModels(uuids: string[]): TViewModel[] {
    const all = this.allViewModels();
    return uuids
      .map(uuid => all.get(uuid))
      .filter((vm): vm is TViewModel => !!vm);
  }

  // --- Protected hooks for sub-classes to implement ---

  /**
   * Fetch UUIDs matching the given filter.
   */
  protected abstract fetchSearch(filters: TFilters): Observable<string[]>;

  /**
   * Fetch DTOs matching the given list of UUIDs.
   */
  protected abstract fetchData(uuids: string[]): Observable<TDto[]>;

  /**
   * Enrich raw DTO data to a fully mapped View Model.
   * Can safely call other orchestrators' signals/computed/methods inside.
   */
  protected abstract enrich(dto: TDto): TViewModel;

  /**
   * Intercept DTOs post-fetch to start loading child dependencies asynchronously.
   * Should return an array of Observables.
   */
  protected resolveDependencies(dtos: TDto[], options?: TOptions): Observable<unknown>[] {
    void dtos;
    void options;
    return [];
  }
}

