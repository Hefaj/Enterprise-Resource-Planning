import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogProductOrchestrator } from '@erp/catalog/data-access';
import { ErpTableComponent, ErpTableBuilder } from '@erp/shared/ui';
import { ProductViewModel } from '@erp/catalog/util';

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

  protected readonly products = computed<ProductViewModel[]>(() => {
    const results = this._catalogProductOrchestrator.searchResults();
    return results.map(p => ({
      ...p,
      category: p.categories.map(c => c.name).join(', '),
      modelName: p.model?.name ?? '',
    })) as ProductViewModel[];
  });

  protected readonly isLoading = this._catalogProductOrchestrator.isLoading;

  protected readonly tableConfig = computed(() => {
    return ErpTableBuilder.create((b) => {
      b.setData(this.products)
        .setLoading(this.isLoading)
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
        .setPagination(10, [10, 25, 50])
        .setEmptyMessage('Nie znaleziono produktów')
        .setSize('small');
    });
  });
}
