import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ErpTreeComponent,
  ErpTreeBuilder,
  ErpTreeConfig,
  ErpTreeSelectionState,
  ErpTreeNodeAdapters,
} from '@erp/shared/ui';

import { CatalogCategoryOrchestrator, CategoryTreeNodeVM } from '@erp/catalog/data-access';

import { CATEGORY_KEYS } from '../../../translation';

const ADAPTERS: ErpTreeNodeAdapters<CategoryTreeNodeVM> = {
  getId: (item) => item.uuid,
  getParentId: (item) => item.parentUuid,
  getLabel: (item) => item.name,
  hasChildren: (item) => item.hasChildren,
  childCount: (item) => item.childCount,
  descendantCount: (item) => item.descendantCount,
};

/**
 * Drzewo kategorii katalogu — smart component spinający atom `erp-tree` (tryb server,
 * leniwe doładowywanie dzieci + wyszukiwanie) z `CatalogCategoryOrchestrator`.
 */
@Component({
  selector: 'erp-catalog-category-tree',
  standalone: true,
  imports: [CommonModule, ErpTreeComponent],
  template: `
    <erp-tree
      class="block h-full w-full"
      [config]="treeConfig()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogCategoryTreeComponent {
  private readonly categoryOrchestrator = inject(CatalogCategoryOrchestrator);

  /** Tryb zaznaczania — pojedynczy węzeł lub wielokrotny (z kaskadą na poddrzewo). */
  selectionMode = input<'none' | 'single' | 'multi'>('multi');

  /** Czy zaznaczenie rodzica ma kaskadować na dzieci (patrz erp-tree-selection.model.ts). */
  cascade = input<'none' | 'subtree'>('subtree');

  /** Zdarzenie zmiany zaznaczenia w drzewie. */
  selectionChange = output<ErpTreeSelectionState<CategoryTreeNodeVM>>();

  treeConfig = computed<ErpTreeConfig<CategoryTreeNodeVM>>(() =>
    new ErpTreeBuilder<CategoryTreeNodeVM>()
      .setMode('server')
      .setAdapters(ADAPTERS)
      .setSelectionMode(this.selectionMode())
      .setCascade(this.cascade())
      .setAllowDescendantsOnly(true)
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(36)
      .setPageSize(50)
      .setShowSearch(true)
      .setSearchPlaceholder(CATEGORY_KEYS.tree.searchPlaceholder)
      .setEmptyMessage(CATEGORY_KEYS.tree.empty)
      .setLoadChildrenFn((query) =>
        this.categoryOrchestrator.getCategoryTreeChildrenAsync(query.parentId, query.pageIndex, query.pageSize),
      )
      .setSearchFn((query) => this.categoryOrchestrator.searchCategoryTreeAsync(query.search))
      .setOnSelectionChange((state) => this.selectionChange.emit(state))
      .build(),
  );
}
