import { Injectable, signal } from '@angular/core';
import {
  ErpDocumentationLocale,
  ErpDocumentationModuleDescriptor,
  ErpDocumentationSearchEntry,
  ErpRemoteDocumentationDescriptor,
} from '@erp/shared/util';

export interface ErpDocumentationIndexLoadResult {
  readonly module: ErpDocumentationModuleDescriptor;
  readonly entries: readonly ErpDocumentationSearchEntry[];
  readonly error?: unknown;
}

@Injectable({ providedIn: 'root' })
export class ErpDocumentationRegistryService {
  private readonly _modules = signal<readonly ErpRemoteDocumentationDescriptor[]>([]);
  private readonly _cache = new Map<string, Promise<readonly ErpDocumentationSearchEntry[]>>();

  public readonly modules = this._modules.asReadonly();

  public register(descriptor: ErpRemoteDocumentationDescriptor): void {
    this._modules.update((modules) => [
      ...modules.filter((module) => module.moduleId !== descriptor.moduleId),
      descriptor,
    ]);
  }

  public async loadIndex(
    descriptor: ErpRemoteDocumentationDescriptor,
    locale: ErpDocumentationLocale,
  ): Promise<ErpDocumentationIndexLoadResult> {
    const cacheKey = `${descriptor.moduleId}:${locale}`;
    let loader = this._cache.get(cacheKey);
    if (!loader) {
      loader = descriptor.loadIndex(locale);
      this._cache.set(cacheKey, loader);
    }

    try {
      return { module: descriptor, entries: await loader };
    } catch (error) {
      this._cache.delete(cacheKey);
      console.warn(`[Documentation] Nie udało się załadować indeksu modułu "${descriptor.moduleId}" dla ${locale}.`, error);
      return { module: descriptor, entries: [], error };
    }
  }

  public clearLocale(locale: ErpDocumentationLocale): void {
    for (const key of this._cache.keys()) {
      if (key.endsWith(`:${locale}`)) this._cache.delete(key);
    }
  }
}
