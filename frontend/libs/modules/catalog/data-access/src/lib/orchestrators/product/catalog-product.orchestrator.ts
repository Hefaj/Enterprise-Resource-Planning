import { Injectable, inject, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import { CatalogBffClient, ProductDto, SearchProductRequest, SearchResponse, BatchCommandOfProductSetPriceCommand, BatchCommandOfProductSetNameCommand, BatchResult } from '../../api-client';
import { ProductVM, CatalogProductLoadOptions } from './product.view-model';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';
import { CatalogCategoryOrchestrator } from '../category/catalog-category.orchestrator';
import { CatalogModelOrchestrator } from '../model/catalog-model.orchestrator';

/**
 * Struktura rozwiązanych zależności do mapowania ViewModel produktu.
 */
interface ProductResolvedDeps extends ResolvedDeps {
  categories: CategoryVM[];
  model: ModelVM | null;
}

/**
 * Orkiestrator dla agregatu produktu (Product) w module Catalog.
 *
 * To jest najbardziej złożony orkiestrator, demonstrujący:
 * - **Leniwe wstrzykiwanie (lazy injection)** sąsiednich orkiestratorów przez Injector w celu uniknięcia kołowej zależności
 * - **Eager loading** kategorii i modeli na podstawie LoadOptions
 * - **Mapowanie DTO → ViewModel**, które rozwiązuje categoryUuids i modelUuid do bogatych obiektów zagnieżdżonych
 */
@Injectable({ providedIn: 'root' })
export class CatalogProductOrchestrator extends BaseOrchestrator<
  ProductDto,
  ProductVM,
  SearchProductRequest,
  CatalogProductLoadOptions
> {
  private readonly _api = inject(CatalogBffClient);
  private readonly _injector = inject(Injector);

  // Leniwie ładowane sąsiednie orkiestratorzy w celu uniknięcia kołowej zależności
  private _categoryOrchestrator: CatalogCategoryOrchestrator | null = null;
  private _modelOrchestrator: CatalogModelOrchestrator | null = null;

  protected override readonly signature = 'catalog.product';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'catalog.product',
    // Produkty są najcięższym agregatem — maksymalny cache
    maxCacheSize: 1000,
    maxChunkSize: 100,
    bufferTimeMs: 50,
  };

  // ────────────────────────────────────────────────────────────────
  // Leniwe wstrzykiwanie (Zapobieganie kołowej zależności)
  // ────────────────────────────────────────────────────────────────

  private get _categorySiblingOrchestrator(): CatalogCategoryOrchestrator {
    if (!this._categoryOrchestrator) {
      this._categoryOrchestrator = this._injector.get(CatalogCategoryOrchestrator);
    }
    return this._categoryOrchestrator;
  }

  private get _modelSiblingOrchestrator(): CatalogModelOrchestrator {
    if (!this._modelOrchestrator) {
      this._modelOrchestrator = this._injector.get(CatalogModelOrchestrator);
    }
    return this._modelOrchestrator;
  }

  // ────────────────────────────────────────────────────────────────
  // Abstrakcyjne implementacje
  // ────────────────────────────────────────────────────────────────

  protected override fetchByUuids(uuids: string[]): Observable<ProductDto[]> {
    return this._api.getProduct({ uuids });
  }

  protected override searchByFilters(
    filters: SearchProductRequest,
  ): Observable<SearchResponse> {
    return this._api.searchProduct(filters);
  }

  protected override mapToViewModel(
    dto: ProductDto,
    resolvedDeps: ResolvedDeps,
  ): ProductVM {
    const deps = resolvedDeps as ProductResolvedDeps;

    return {
      ...dto,
      categories: deps.categories ?? [],
      model: deps.model ?? null,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Eager Loading: Rozwiązywanie zależności produktu
  // ────────────────────────────────────────────────────────────────

  /**
   * Po załadowaniu produktów, natychmiast załaduj ich kategorie i modele.
   *
   * 1. Zbierz wszystkie unikalne categoryUuids i modelUuid z załadowanych produktów
   * 2. Przekaż żądanie do odpowiednich sąsiednich orkiestratorów
   * 3. Produkty są uważane za "gotowe" tylko wtedy, gdy wszystkie zależności zostaną rozwiązane
   */
  protected override async resolveEagerDependencies(
    uuids: string[],
    options: CatalogProductLoadOptions,
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Zbierz odwołania UUID z załadowanych produktów
    const categoryUuids = new Set<string>();
    const modelUuids = new Set<string>();

    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      if (!dto) continue;

      if (options.includeCategories && dto.categoryUuids) {
        for (const catUuid of dto.categoryUuids) {
          categoryUuids.add(catUuid);
        }
      }

      if (options.includeModel && dto.modelUuid) {
        modelUuids.add(dto.modelUuid);
      }
    }

    // Przekaż żądanie do sąsiednich orkiestratorów
    if (categoryUuids.size > 0) {
      promises.push(
        this._categorySiblingOrchestrator.loadAsync([...categoryUuids], { includeParent: true }),
      );
    }

    if (modelUuids.size > 0) {
      promises.push(
        this._modelSiblingOrchestrator.loadAsync([...modelUuids]),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Rozwiąż aktualne zależności dla pojedynczego DTO produktu.
   * Wywoływane synchronicznie podczas ewaluacji Signal/computed.
   * Używa już zapamiętanych danych z sąsiednich orkiestratorów.
   */
  protected override _resolveCurrentDeps(dto: ProductDto): ProductResolvedDeps {
    // Rozwiąż kategorie z cache orkiestratora kategorii
    const categories: CategoryVM[] = dto.categoryUuids
      ? this._categorySiblingOrchestrator.resolveCategoryVMs(dto.categoryUuids)
      : [];

    // Rozwiąż model z cache orkiestratora modeli
    let model: ModelVM | null = null;
    if (dto.modelUuid) {
      const modelDto = this._modelSiblingOrchestrator['identityMap'].peek(dto.modelUuid);
      if (modelDto) {
        model = { ...modelDto };
      }
    }

    return { categories, model };
  }

  /**
   * Wykonaj seryjne polecenie aktualizacji ceny dla wybranych produktów.
   */
  public async setPriceMultiple(
    command: BatchCommandOfProductSetPriceCommand,
    queueID?: string,
  ): Promise<string> {
    const apiCall = (): Observable<string> => this._api.productSetPriceMultipleCommand(command).pipe(
      map((res: BatchResult) => res.jobUuid || '')
    );
    return this.executeCommand(
      'Ustawianie cen produktów',
      apiCall,
      undefined,
      queueID
    );
  }

  /**
   * Wykonaj seryjne polecenie aktualizacji nazwy dla wybranych produktów.
   */
  public async setNameMultiple(
    command: BatchCommandOfProductSetNameCommand,
    queueID?: string,
  ): Promise<string> {
    const apiCall = (): Observable<string> => this._api.productSetNameMultipleCommand(command).pipe(
      map((res: BatchResult) => res.jobUuid || '')
    );
    return this.executeCommand(
      'Ustawianie nazw produktów',
      apiCall,
      undefined,
      queueID
    );
  }
}
