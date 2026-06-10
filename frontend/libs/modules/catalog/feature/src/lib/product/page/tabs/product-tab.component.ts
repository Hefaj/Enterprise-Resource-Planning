import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogProductOrchestrator, CategoryVM, ProductVM } from '@erp/catalog/data-access';
import { ErpTableComponent, ErpTableBuilder } from '@erp/shared/ui';
import { ProductViewModel } from '@erp/catalog/util';
import { ProductListViewStore } from '../product-list-view.store';

/**
 * Komponent zakładki produktów.
 * Wyświetla wyniki wyszukiwania z orkiestratora produktów za pomocą erp-table.
 */
@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `
    <div class="tab-container">
      <erp-table [config]="tableConfig()" />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .tab-container {
      padding: 1rem 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  private readonly _catalogProductOrchestrator = inject(CatalogProductOrchestrator);
  private readonly _store = inject(ProductListViewStore);

  protected readonly products = computed<ProductViewModel[]>(() => {
    const resultsUuids = this._store.searchResultUuids();
    const vmMap = this._catalogProductOrchestrator.getViewModel()();
    return resultsUuids
      .map(uuid => vmMap.get(uuid))
      .filter((p): p is ProductVM => !!p)
      .map(p => ({
        ...p,
        category: p.categories.map((c: CategoryVM) => c.name).join(', '),
        modelName: p.model?.name ?? '',
      })) as ProductViewModel[];
  });

  protected readonly isLoading = this._store.isLoading;
  protected readonly totalRecords = this._store.totalCount;

  protected readonly tableConfig = computed(() => {
    return ErpTableBuilder.create((b) => {
      b.setData(this.products)
        .setLoading(this.isLoading)
        .setTotalRecords(this.totalRecords)
        .addColumn('sku', 'SKU', { sortable: true, width: '130px' })
        .addLinkColumn('name', 'Nazwa produktu', {
          onClick: (row) => console.log('Otwórz produkt:', row),
        }, { sortable: true, minWidth: '250px' })
        .addColumn('category', 'Kategoria', { sortable: true, width: '180px' })
        .addColumn('modelName', 'Model', { sortable: true, width: '160px' })
        .addColumn('price', 'Cena netto', { sortable: true, align: 'right', pipe: 'currency', width: '160px' })
        .addColumn('availableFrom', 'Dostępny od', { sortable: true, pipe: 'date', width: '150px' })
        .addBadgeColumn('status', 'Status', {
          'Aktywny': 'success',
          'Draft': 'warn',
          'Wycofany': 'danger',
          'Archiwum': 'secondary',
        }, { sortable: true, width: '130px' })
        .addBooleanColumn('available', 'Dostępny', {
          trueIcon: 'pi pi-check-circle',
          falseIcon: 'pi pi-minus-circle',
          trueClass: 'text-green-500',
          falseClass: 'text-surface-300 dark:text-surface-600',
        }, { width: '100px' })
        .setPagination(20, [10, 20, 50])
        .setLazyLoad((event) => {
          const page = Math.floor(event.first / event.rows) + 1;
          this._store.updateSort(event.sortField, event.sortOrder);
          this._store.updatePagination(page, event.rows);
        })
        .setEmptyMessage('Nie znaleziono produktów')
        .setSize('small');
    });
  });
}
