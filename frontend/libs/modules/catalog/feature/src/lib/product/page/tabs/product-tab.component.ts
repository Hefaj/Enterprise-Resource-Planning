import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { CatalogProductOrchestrator, CategoryVM, ProductVM, BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';
import { ErpTableComponent, ErpTableBuilder, ErpModalService } from '@erp/shared/ui';
import { ProductViewModel } from '@erp/catalog/util';
import { ProductListViewStore } from '../product-list-view.store';
import {
  ProductModalRegistration,
  SET_PRICE_MODAL_ID,
  SetPriceMetadata
} from '../../modal';
import { PRODUCT_KEYS } from '../../translation';

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
  private readonly _modalService = inject(ErpModalService);

  // Rejestracja modali produktowych (wystarczy inject — konstruktor robi register)
  private readonly _ = inject(ProductModalRegistration);

  protected readonly products = computed<ProductViewModel[]>(() => {
    const resultsUuids = this._store.searchResultUuids();
    const vmMap = this._catalogProductOrchestrator.getViewModel()();

    return resultsUuids
      .map(uuid => vmMap.get(uuid))
      .filter((p): p is ProductVM => !!p)
      .map(p => {
        let statusTranslated = p.status;
        if (p.status === 'Aktywny') statusTranslated = PRODUCT_KEYS.enums.status.active;
        else if (p.status === 'Draft') statusTranslated = PRODUCT_KEYS.enums.status.draft;
        else if (p.status === 'Wycofany') statusTranslated = PRODUCT_KEYS.enums.status.withdrawn;
        else if (p.status === 'Archiwum') statusTranslated = PRODUCT_KEYS.enums.status.archive;

        return {
          ...p,
          category: p.categories.map((c: CategoryVM) => c.name).join(', '),
          modelName: p.model?.name ?? '',
          status: statusTranslated,
        };
      }) as ProductViewModel[];
  });

  protected readonly isLoading = this._store.isLoading;
  protected readonly totalRecords = this._store.totalCount;
  protected readonly selectedProducts = signal<ProductViewModel[]>([]);

  // ── Context Menu Items ──

  private readonly _contextMenuItems = computed<MenuItem[]>(() => {
    const actions: MenuItem[] = [];
    const products = this._getSelectedProducts();
    if (products.length > 0) {
          actions.push({
            label: PRODUCT_KEYS.commands.setPrice.label,
            icon: 'pi pi-money-bill',
            command: () => {
              this._modalService.open<BatchCommandOfProductSetPriceCommand, SetPriceMetadata>(SET_PRICE_MODAL_ID, {
                products: products.map(p => ({ uuid: p.uuid, sku: p.sku, price: p.price })),
                price: null,
              });
            },
          });
    }

    return actions;
  });

  // ── Table Config ──

  protected readonly tableConfig = computed(() => {
    return ErpTableBuilder.create((b) => {
      b.setData(this.products)
        .setSelectionMode('multiple')
        .setSelection(this.selectedProducts)
        .setLoading(this.isLoading)
        .setTotalRecords(this.totalRecords)
        .addColumn('sku', PRODUCT_KEYS.base.table.columns.sku, { sortable: true, width: '130px' })
        .addLinkColumn('name', PRODUCT_KEYS.base.table.columns.name, {
          onClick: (row) => console.log('Otwórz produkt:', row),
        }, { sortable: true, minWidth: '250px' })
        .addColumn('category', PRODUCT_KEYS.base.table.columns.category, { sortable: true, width: '180px' })
        .addColumn('modelName', PRODUCT_KEYS.base.table.columns.modelName, { sortable: true, width: '160px' })
        .addColumn('price', PRODUCT_KEYS.base.table.columns.price, { sortable: true, align: 'right', pipe: 'currency', width: '160px' })
        .addColumn('availableFrom', PRODUCT_KEYS.base.table.columns.availableFrom, { sortable: true, pipe: 'date', width: '150px' })
        .addBadgeColumn('status', PRODUCT_KEYS.base.table.columns.status, {
          [PRODUCT_KEYS.enums.status.active]: 'success',
          [PRODUCT_KEYS.enums.status.draft]: 'warn',
          [PRODUCT_KEYS.enums.status.withdrawn]: 'danger',
          [PRODUCT_KEYS.enums.status.archive]: 'secondary',
        }, { sortable: true, width: '130px' })
        .addBooleanColumn('available', PRODUCT_KEYS.base.table.columns.available, {
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
        .setContextMenuItems(this._contextMenuItems)
        .setEmptyMessage(PRODUCT_KEYS.base.table.emptyMessage)
        .setSize('small');
    });
  });

  // ── Helpers ──

  private _getSelectedProducts(): ProductViewModel[] {
    return this.selectedProducts();
  }
}
