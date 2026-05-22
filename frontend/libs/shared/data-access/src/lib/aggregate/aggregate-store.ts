import { Injectable, signal, WritableSignal, Injector, inject, Type } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AggregateStore {
  // Central data bag storing raw DTO cache signals by aggregate signature name
  private readonly _caches = new Map<string, WritableSignal<Map<string, unknown>>>();

  // Central orchestrator registry mapping aggregate signature to the orchestrator instance
  private readonly _orchestrators = new Map<string, unknown>();

  // Static token registry mapping signature string to Class type
  private static readonly _tokenRegistry = new Map<string, Type<unknown>>();

  private readonly _injector = inject(Injector);

  /**
   * Register an orchestrator class token statically so it can be resolved dynamically.
   */
  public static registerToken(signature: string, token: Type<unknown>): void {
    this._tokenRegistry.set(signature, token);
  }

  /**
   * Register a concrete orchestrator instance dynamically.
   */
  public register(signature: string, orchestrator: unknown): void {
    console.log(`[AggregateStore] Registering orchestrator for signature: ${signature}`);
    this._orchestrators.set(signature, orchestrator);
  }

  /**
   * Check if an orchestrator is registered.
   */
  public hasOrchestrator(signature: string): boolean {
    return this._orchestrators.has(signature);
  }

  /**
   * Retrieve an orchestrator instance dynamically by its signature.
   * Resolves from the Injector if the class token is registered but the instance is not yet created.
   */
  public getOrchestrator<T = unknown>(signature: string): T {
    let orchestrator = this._orchestrators.get(signature);
    if (!orchestrator) {
      const token = AggregateStore._tokenRegistry.get(signature);
      if (!token) {
        throw new Error(`[AggregateStore] Orchestrator token for signature "${signature}" is not registered.`);
      }
      console.log(`[AggregateStore] Instantiating orchestrator dynamically for signature: ${signature}`);
      orchestrator = this._injector.get(token);
    }
    return orchestrator as T;
  }

  /**
   * Get or create a central cache signal containing raw DTOs for a specific aggregate signature.
   */
  public getCacheSignal<TDto>(signature: string): WritableSignal<Map<string, TDto>> {
    let cache = this._caches.get(signature);
    if (!cache) {
      cache = signal<Map<string, unknown>>(new Map());
      this._caches.set(signature, cache);
    }
    return cache as WritableSignal<Map<string, TDto>>;
  }

  /**
   * Directly update the raw DTO cache for a specific signature.
   */
  public updateCache<TDto extends { uuid: string }>(signature: string, dtos: TDto[]): void {
    const cacheSignal = this.getCacheSignal<TDto>(signature);
    cacheSignal.update(current => {
      const next = new Map(current);
      for (const dto of dtos) {
        next.set(dto.uuid, dto);
      }
      return next;
    });
  }
}
