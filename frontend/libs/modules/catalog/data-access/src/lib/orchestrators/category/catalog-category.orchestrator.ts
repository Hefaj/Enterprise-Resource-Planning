import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps, LoadOptions } from '@erp/shared/data-access';
import { CatalogClient, CategoryDto, SearchCategoryRequest, SearchResponse } from '../../api-client';
import { CategoryVM, CategoryTreeNodeVM } from './category.view-model';
import {
  mockGetCategoryChildren,
  mockResolveCategoryDescendants,
  mockSearchCategoryTree,
  MockCategoryNode,
} from './category-tree.mock-data';

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
  // Drzewo kategorii (erp-tree / erp-tree-picker) — MOCK
  //
  // Backend nie udostępnia dziś zapytań hierarchicznych — poniższe metody wołają
  // `category-tree.mock-data.ts` (tam pełny opis docelowych endpointów: trasa,
  // kształt request/response, przykładowe zapytanie SQL na closure table).
  // Wymiana na realne API sprowadza się do podmiany ciała tych trzech metod —
  // sygnatury (i to, co zwracają) są już zgodne z docelowym kontraktem.
  // ────────────────────────────────────────────────────────────────

  private _toTreeNodeVM(node: MockCategoryNode): CategoryTreeNodeVM {
    this.identityMap.set(node.dto);
    return {
      ...this.mapToViewModel(node.dto, {}),
      hasChildren: node.hasChildren,
      childCount: node.childCount,
      descendantCount: node.descendantCount,
    };
  }

  /** MOCK — docelowo `GET /api/catalog/categories/children`, patrz category-tree.mock-data.ts */
  public async getCategoryTreeChildrenAsync(
    parentUuid: string | null,
    pageIndex: number,
    pageSize: number,
  ): Promise<{ nodes: CategoryTreeNodeVM[]; totalCount: number }> {
    const { nodes, totalCount } = await mockGetCategoryChildren(parentUuid, pageIndex, pageSize);
    return { nodes: nodes.map((n) => this._toTreeNodeVM(n)), totalCount };
  }

  /** MOCK — docelowo `GET /api/catalog/categories/search-tree`, patrz category-tree.mock-data.ts */
  public async searchCategoryTreeAsync(
    search: string,
  ): Promise<{ matches: CategoryTreeNodeVM[]; ancestors: CategoryTreeNodeVM[]; totalCount: number }> {
    const result = await mockSearchCategoryTree(search);
    return {
      matches: result.matches.map((n) => this._toTreeNodeVM(n)),
      ancestors: result.ancestors.map((n) => this._toTreeNodeVM(n)),
      totalCount: result.totalCount,
    };
  }

  /** MOCK — docelowo `POST /api/catalog/categories/resolve-descendants`, patrz category-tree.mock-data.ts */
  public async resolveCategoryDescendantsAsync(uuids: string[]): Promise<string[]> {
    return mockResolveCategoryDescendants(uuids);
  }
}
