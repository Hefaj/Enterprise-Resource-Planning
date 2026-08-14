import { Injectable, inject, Injector } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import { CatalogClient, ProductDto, SearchProductRequest, SearchResponse, BatchCommandOfProductSetPriceCommandAndSearchProductRequest, BatchCommandOfProductSetNameCommandAndSearchProductRequest, BatchResult } from '../../api-client';
import { ProductVM, CatalogProductLoadOptions, ProductWarrantyVM } from './product.view-model';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';
import { CatalogCategoryOrchestrator } from '../category/catalog-category.orchestrator';
import { CatalogModelOrchestrator } from '../model/catalog-model.orchestrator';
import { MultimediaVM } from '../multimedia/multimedia.view-model';
import { CatalogMultimediaOrchestrator } from '../multimedia/catalog-multimedia.orchestrator';
import { CatalogWarrantyOrchestrator } from '../warranty/catalog-warranty.orchestrator';

/**
 * Struktura rozwiązanych zależności do mapowania ViewModel produktu.
 */
interface ProductResolvedDeps extends ResolvedDeps {
  categories: CategoryVM[];
  model: ModelVM | null;
  multimedia: MultimediaVM[];
  warranties: ProductWarrantyVM[];
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
  private readonly _api = inject(CatalogClient);
  private readonly _injector = inject(Injector);

  // Leniwie ładowane sąsiednie orkiestratorzy w celu uniknięcia kołowej zależności
  private _categoryOrchestrator: CatalogCategoryOrchestrator | null = null;
  private _modelOrchestrator: CatalogModelOrchestrator | null = null;
  private _multimediaOrchestrator: CatalogMultimediaOrchestrator | null = null;
  private _warrantyOrchestrator: CatalogWarrantyOrchestrator | null = null;

  // Gettery, nie pola — patrz uzasadnienie przy CatalogMultimediaOrchestrator
  // (frontend/libs/modules/catalog/data-access/.../catalog-multimedia.orchestrator.ts).
  protected override get signature(): string {
    return 'catalog.product';
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    return {
      signalrSignature: 'catalog.product',
      // Produkty są najcięższym agregatem — maksymalny cache
      maxCacheSize: 1000,
      maxChunkSize: 100,
      bufferTimeMs: 50,
    };
  }

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

  private get _multimediaSiblingOrchestrator(): CatalogMultimediaOrchestrator {
    if (!this._multimediaOrchestrator) {
      this._multimediaOrchestrator = this._injector.get(CatalogMultimediaOrchestrator);
    }
    return this._multimediaOrchestrator;
  }

  private get _warrantySiblingOrchestrator(): CatalogWarrantyOrchestrator {
    if (!this._warrantyOrchestrator) {
      this._warrantyOrchestrator = this._injector.get(CatalogWarrantyOrchestrator);
    }
    return this._warrantyOrchestrator;
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
      multimedia: deps.multimedia ?? [],
      warranties: deps.warranties ?? [],
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
    const multimediaUuids = new Set<string>();
    const warrantyUuids = new Set<string>();

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

      // Założenie: ProductDto posiada multimediaUuids
      if (options.includeMultimedia && dto.multimediaUuids) {
        for (const mUuid of dto.multimediaUuids) {
          multimediaUuids.add(mUuid);
        }
      }

      if (options.includeWarranties && dto.warranties) {
        for (const w of dto.warranties) {
          warrantyUuids.add(w.warrantyUuid);
        }
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

    if (multimediaUuids.size > 0) {
      promises.push(
        this._multimediaSiblingOrchestrator.loadAsync([...multimediaUuids]),
      );
    }

    if (warrantyUuids.size > 0) {
      promises.push(
        this._warrantySiblingOrchestrator.loadAsync([...warrantyUuids]),
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
      model = this._modelSiblingOrchestrator.resolveModelVM(dto.modelUuid);
    }

    // Rozwiąż multimedia z cache orkiestratora multimediów
    const multimedia: MultimediaVM[] = dto.multimediaUuids
      ? this._multimediaSiblingOrchestrator.resolveMultimediaVMs(dto.multimediaUuids)
      : [];

    // Wzbogać przypisania produkt-gwarancja o katalogową gwarancję (per UUID, z cache orkiestratora gwarancji)
    const warranties: ProductWarrantyVM[] = (dto.warranties ?? []).map(assignment => ({
      ...assignment,
      productUuid: dto.uuid,
      warranty: this._warrantySiblingOrchestrator.resolveWarrantyVM(assignment.warrantyUuid),
    }));

    return { categories, model, multimedia, warranties };
  }

  /**
   * Wykonaj seryjne polecenie aktualizacji ceny dla wybranych produktów.
   */
  public async setPriceMultiple(
    command: BatchCommandOfProductSetPriceCommandAndSearchProductRequest,
    queueID?: string,
  ): Promise<string> {
    try {
      const result = await firstValueFrom(
        this._api.productSetPriceMultipleCommand(command)
      );
      const jobUuid = result.jobUuid || '';

      this.jobService.addJob(jobUuid, queueID, {
        commandName: 'catalog.product.commands.setPrice',
        timestamp: new Date(),
      });

      return jobUuid;
    } catch (err) {
      this.addError({
        operation: 'command',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    }
  }

  /**
   * Wykonaj seryjne polecenie aktualizacji nazwy dla wybranych produktów.
   */
  public async setNameMultiple(
    command: BatchCommandOfProductSetNameCommandAndSearchProductRequest,
    queueID?: string,
  ): Promise<string> {
    try {
      const result = await firstValueFrom(
        this._api.productSetNameMultipleCommand(command)
      );
      const jobUuid = result.jobUuid || '';

      this.jobService.addJob(jobUuid, queueID, {
        commandName: 'catalog.product.commands.setName',
        timestamp: new Date(),
      });

      return jobUuid;
    } catch (err) {
      this.addError({
        operation: 'command',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    }
  }
}
