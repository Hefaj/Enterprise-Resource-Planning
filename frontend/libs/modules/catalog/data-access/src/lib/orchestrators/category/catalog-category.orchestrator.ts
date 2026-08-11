import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps, LoadOptions } from '@erp/shared/data-access';
import { CatalogClient, CategoryDto, CategoryTreeNodeDto, SearchCategoryRequest, SearchResponse } from '../../api-client';
import { CategoryVM, CategoryTreeNodeVM } from './category.view-model';

/**
 * Maksymalna głębokość dla rozwiązywania łańcuchów kategorii nadrzędnych.
 * Zapobiega nieskończonej rekurencji, gdy kategorie tworzą głębokie hierarchie.
 */
const MAX_PARENT_DEPTH = 3;

/**
 * Orkiestrator dla agregatu kategorii (Category) w module Catalog.
 *
 * Obsługuje rekurencyjne rozwiązywanie parentUuid z zabezpieczeniem maksymalnej głębokości.
 * Gdy CategoryDto posiada parentUuid, orkiestrator mapuje go na zagnieżdżony obiekt
 * CategoryVM.parent — do poziomu MAX_PARENT_DEPTH.
 */
@Injectable({ providedIn: 'root' })
export class CatalogCategoryOrchestrator extends BaseOrchestrator<
  CategoryDto,
  CategoryVM,
  SearchCategoryRequest,
  LoadOptions
> {
  private readonly _api = inject(CatalogClient);

  protected override readonly signature = 'catalog.category';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'catalog.category',
    maxCacheSize: 500, // Kategorie są zazwyczaj mniej liczne niż produkty
  };

  // ────────────────────────────────────────────────────────────────
  // Abstrakcyjne implementacje
  // ────────────────────────────────────────────────────────────────

  protected override fetchByUuids(uuids: string[]): Observable<CategoryDto[]> {
    return this._api.getCategory({ uuids });
  }

  protected override searchByFilters(
    filters: SearchCategoryRequest,
  ): Observable<SearchResponse> {
    return this._api.searchCategory(filters);
  }

  protected override mapToViewModel(dto: CategoryDto, _resolvedDeps: ResolvedDeps): CategoryVM {
    return this._mapWithDepthGuard(dto, 0);
  }

  // ────────────────────────────────────────────────────────────────
  // Eager Loading: Rozwiązywanie łańcucha nadrzędnego
  // ────────────────────────────────────────────────────────────────

  /**
   * Po załadowaniu kategorii, natychmiast załaduj ich łańcuch nadrzędny
   * do poziomu MAX_PARENT_DEPTH.
   */
  protected override async resolveEagerDependencies(
    uuids: string[],
    _options: LoadOptions,
  ): Promise<void> {
    await this._loadParentChain(uuids, 0);
  }

  /**
   * Rekurencyjne ładowanie kategorii nadrzędnych do maksymalnej głębokości.
   */
  private async _loadParentChain(uuids: string[], depth: number): Promise<void> {
    if (depth >= MAX_PARENT_DEPTH) return;

    // Zbierz wszystkie parentUuids z aktualnie załadowanych kategorii
    const parentUuids = new Set<string>();
    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      if (dto?.parentUuid) {
        parentUuids.add(dto.parentUuid);
      }
    }

    if (parentUuids.size === 0) return;

    // Załaduj rodziców
    const missingParents = [...parentUuids].filter(uuid => !this.identityMap.has(uuid));
    if (missingParents.length > 0) {
      await this.dataLoader.loadAsync(missingParents);
    }

    // Rekurencja dla następnego poziomu
    await this._loadParentChain([...parentUuids], depth + 1);
  }

  // ────────────────────────────────────────────────────────────────
  // Wewnętrzne: Rekurencyjne mapowanie DTO → VM z zabezpieczeniem głębokości
  // ────────────────────────────────────────────────────────────────

  private _mapWithDepthGuard(dto: CategoryDto, depth: number): CategoryVM {
    let parent: CategoryVM | null = null;

    if (dto.parentUuid && depth < MAX_PARENT_DEPTH) {
      const parentDto = this.identityMap.peek(dto.parentUuid);
      if (parentDto) {
        parent = this._mapWithDepthGuard(parentDto, depth + 1);
      }
    }

    return {
      ...dto,
      parent,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Publiczne: Metoda pomocnicza dla zewnętrznych orkiestratorów
  // ────────────────────────────────────────────────────────────────

  /**
   * Rozwiąż listę UUID kategorii do obiektów CategoryVM.
   * Używane przez CatalogProductOrchestrator do uzupełnienia Product.categories.
   * Zwraca tylko te kategorie, które są już w pamięci podręcznej (cache).
   */
  public resolveCategoryVMs(uuids: string[]): CategoryVM[] {
    const result: CategoryVM[] = [];
    for (const uuid of uuids) {
      const dtoSignal = this.identityMap.get(uuid);
      const dto = dtoSignal();
      if (dto) {
        result.push(this._mapWithDepthGuard(dto, 0));
      }
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // Drzewo kategorii (erp-tree / erp-tree-picker)
  //
  // Leniwe doładowywanie dzieci + wyszukiwanie z kontekstem hierarchii + rozwijanie zaznaczenia
  // poddrzewa do płaskiej listy uuid — endpointy `Catalog.Category.Query.GetCategoryChildren` /
  // `SearchCategoryTree` / `ResolveCategoryDescendants` w backendzie.
  // ────────────────────────────────────────────────────────────────

  private _toTreeNodeVM(node: CategoryTreeNodeDto): CategoryTreeNodeVM {
    const dto: CategoryDto = { uuid: node.uuid, name: node.name, parentUuid: node.parentUuid };
    this.identityMap.set(dto);
    return {
      ...this.mapToViewModel(dto, {}),
      hasChildren: node.hasChildren,
      childCount: node.childCount,
      descendantCount: node.descendantCount,
    };
  }

  public async getCategoryTreeChildrenAsync(
    parentUuid: string | null,
    pageIndex: number,
    pageSize: number,
  ): Promise<{ nodes: CategoryTreeNodeVM[]; totalCount: number }> {
    const { nodes, totalCount } = await firstValueFrom(
      this._api.getCategoryChildren({ parentUuid: parentUuid ?? undefined, pageIndex, pageSize }),
    );
    return { nodes: (nodes ?? []).map((n) => this._toTreeNodeVM(n)), totalCount: totalCount ?? 0 };
  }

  public async searchCategoryTreeAsync(
    search: string,
  ): Promise<{ matches: CategoryTreeNodeVM[]; ancestors: CategoryTreeNodeVM[]; totalCount: number }> {
    const { matches, ancestors, totalCount } = await firstValueFrom(this._api.searchCategoryTree({ search }));
    return {
      matches: (matches ?? []).map((n) => this._toTreeNodeVM(n)),
      ancestors: (ancestors ?? []).map((n) => this._toTreeNodeVM(n)),
      totalCount: totalCount ?? 0,
    };
  }

  public async resolveCategoryDescendantsAsync(uuids: string[]): Promise<string[]> {
    const { uuids: resolvedUuids, truncated } = await firstValueFrom(this._api.resolveCategoryDescendants({ uuids }));
    if (truncated) {
      console.warn('[CatalogCategoryOrchestrator] resolveCategoryDescendants: wynik ucięty na limicie backendu.');
    }
    return resolvedUuids ?? [];
  }
}
