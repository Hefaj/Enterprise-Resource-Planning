import { inject, DestroyRef, computed, Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { SignalrSyncService } from '../sync/signalr-sync.service';
import { AggregateStore } from './aggregate-store';

export interface BaseDto {
  uuid: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

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

  public constructor() {
    this.store.register(this.signature, this);
    this._initializeRealtimeSync();
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
            this.load(toReload).subscribe();
          }
        },
        error: (err: unknown) => console.error(`[BaseOrchestrator - ${this.signature}] Sync error:`, err),
        complete: () => console.log(`[BaseOrchestrator - ${this.signature}] Sync subscription completed.`)
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
   * Triggers background dependency resolution based on `options`.
   */
  public load(uuids: string[], options?: TOptions): Observable<TViewModel[]> {
    if (!uuids || uuids.length === 0) {
      return of([]);
    }

    return this.fetchData(uuids).pipe(
      tap(dtos => this.updateCache(dtos)),
      switchMap(dtos => {
        const depLoads = this.resolveDependencies(dtos, options);
        if (depLoads.length > 0) {
          return forkJoin(depLoads).pipe(
            map(() => this._mapUuidsToViewModels(uuids))
          );
        }
        return of(this._mapUuidsToViewModels(uuids));
      })
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
