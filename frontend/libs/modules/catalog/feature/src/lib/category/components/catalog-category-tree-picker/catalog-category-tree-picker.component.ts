import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl } from '@angular/forms';

import {
  ErpTreePickerComponent,
  ErpTreePickerConfig,
  ErpTreeNodeAdapters,
  ErpTreeSelectionValue,
  erpTreeEmptySelection,
  erpTreeIsEmptySelection,
} from '@erp/shared/ui';

import { CatalogCategoryOrchestrator, CategoryTreeNodeVM, TreeSelectionRequest } from '@erp/catalog/data-access';

import { CATEGORY_KEYS } from '../../translation';

const ADAPTERS: ErpTreeNodeAdapters<CategoryTreeNodeVM> = {
  getId: (item) => item.uuid,
  getParentId: (item) => item.parentUuid,
  getLabel: (item) => item.name,
  hasChildren: (item) => item.hasChildren,
  childCount: (item) => item.childCount,
  descendantCount: (item) => item.descendantCount,
};

/** Konfiguracja wystawiana na zewnątrz — bez pól wiązanych wewnętrznie z orkiestratorem (mode/adapters/loadChildrenFn/searchFn). */
export type CatalogCategoryTreePickerConfig = Omit<
  ErpTreePickerConfig<CategoryTreeNodeVM>,
  'mode' | 'adapters' | 'items' | 'loadChildrenFn' | 'searchFn'
>;

/**
 * Konwertuje deskryptor zaznaczenia kategorii przyjmowany przez `SearchProductRequest.category`
 * (płaski DTO `{ ids, subtreeRoots, excluded }`) na `ErpTreeSelectionValue` oczekiwany przez
 * `erp-tree-picker`. Kształt obu typów jest celowo identyczny — backendowy `TreeSelectionRequest`
 * to wprost odpowiednik frontendowego deskryptora selekcji, nie osobny format do mapowania.
 */
export function categoryUuidsToSelection(selection: TreeSelectionRequest | null | undefined): ErpTreeSelectionValue {
  if (!selection) return erpTreeEmptySelection();
  return {
    ids: selection.ids ?? [],
    subtreeRoots: selection.subtreeRoots ?? [],
    excluded: selection.excluded ?? [],
  };
}

/** Odwrotność `categoryUuidsToSelection` — do użycia przy wysyłce filtrów do API. */
export function categorySelectionToUuids(value: ErpTreeSelectionValue | null | undefined): TreeSelectionRequest | undefined {
  if (!value || erpTreeIsEmptySelection(value)) return undefined;
  return {
    ids: [...value.ids],
    subtreeRoots: [...value.subtreeRoots],
    excluded: [...value.excluded],
  };
}

/**
 * Tree-picker kategorii katalogu — smart component spinający `erp-tree-picker` (tryb server,
 * leniwe doładowywanie dzieci + wyszukiwanie) z `CatalogCategoryOrchestrator`. Odpowiednik
 * `CatalogCategoryTreeComponent`, ale w wariancie pola formularza (dropdown zamiast stałego drzewa) —
 * m.in. do użycia w panelach filtrów (`erp-filter` / `addCustomFormField`).
 */
@Component({
  selector: 'erp-catalog-category-tree-picker',
  standalone: true,
  imports: [ErpTreePickerComponent],
  template: `
    <erp-tree-picker [config]="pickerConfig()" [control]="control()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogCategoryTreePickerComponent {
  private readonly categoryOrchestrator = inject(CatalogCategoryOrchestrator);

  public readonly config = input<CatalogCategoryTreePickerConfig>({});
  public readonly control = input<FormControl<ErpTreeSelectionValue | null> | null>(null);

  protected readonly pickerConfig = computed<ErpTreePickerConfig<CategoryTreeNodeVM>>(() => {
    const cfg = this.config();
    return {
      ...cfg,
      mode: 'server',
      adapters: ADAPTERS,
      strategy: cfg.strategy ?? 'multi',
      cascade: cfg.cascade ?? 'subtree',
      allowDescendantsOnly: cfg.allowDescendantsOnly ?? true,
      searchPlaceholder: cfg.searchPlaceholder ?? CATEGORY_KEYS.tree.searchPlaceholder,
      emptyContent: cfg.emptyContent ?? CATEGORY_KEYS.tree.empty,
      loadChildrenFn: (query) =>
        this.categoryOrchestrator.getCategoryTreeChildrenAsync(query.parentId, query.pageIndex, query.pageSize),
      searchFn: (query) => this.categoryOrchestrator.searchCategoryTreeAsync(query.search),
    };
  });
}
