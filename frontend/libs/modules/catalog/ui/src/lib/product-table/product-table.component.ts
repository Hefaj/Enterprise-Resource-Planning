import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { 
  ErpTableComponent, 
  ErpTableBuilder, 
  ErpTableFilters 
} from '@erp/shared/ui';

/**
 * Biznesowy komponent tabeli produktów.
 * Definiuje kolumny specyficzne dla produktu (miniatura, nazwa jako link, status jako badge).
 * Używa ErpTableComponent jako bazowego silnika renderowania.
 */
@Component({
  selector: 'catalog-product-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `
    <erp-table 
      [config]="tableConfig" 
      [data]="data()" 
      [externalFilters]="externalFilters()" 
      [loading]="loading()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTableComponent {
  /** Dane produktów do wyświetlenia */
  public data = input<any[]>([]);

  /** Filtry zewnętrzne (np. z globalnego panelu ErpDynamicFilter) */
  public externalFilters = input<ErpTableFilters>({});

  /** Stan ładowania */
  public loading = input<boolean>(false);

  /** Kompatybilność z ErpTabs (kontekst zakładki) */
  public tabValue = input<string | number>();

  /** Konfiguracja tabeli z predefiniowanymi kolumnami produktowymi */
  protected readonly tableConfig = ErpTableBuilder.create(b => b
    // Miniatura produktu
    .addImageColumn('image', '', { 
      width: '40px', 
      height: '40px', 
      rounded: false, 
      fallbackIcon: 'pi pi-box' 
    }, { width: '70px' })

    // SKU
    .addColumn('sku', 'SKU', { 
      sortable: true, 
      width: '130px',
    })

    // Nazwa produktu (link)
    .addLinkColumn('name', 'Nazwa produktu', {
      onClick: (row) => console.log('Otwórz produkt:', row)
    }, { sortable: true, minWidth: '250px' })

    // Kategoria
    .addColumn('category', 'Kategoria', { 
      sortable: true, 
      width: '180px' 
    })

    // Cena netto
    .addColumn('price', 'Cena netto', { 
      sortable: true, 
      align: 'right', 
      pipe: 'currency', 
      width: '160px' 
    })

    // Data dostępności
    .addColumn('availableFrom', 'Dostępny od', { 
      sortable: true, 
      pipe: 'date', 
      width: '150px' 
    })

    // Status jako badge z mapowaniem kolorów
    .addBadgeColumn('status', 'Status', {
      'Aktywny': 'success',
      'Draft': 'warn',
      'Wycofany': 'danger',
      'Archiwum': 'secondary',
    }, { sortable: true, width: '130px' })

    // Dostępność jako boolean
    .addBooleanColumn('available', 'Dostępny', {
      trueIcon: 'pi pi-check-circle',
      falseIcon: 'pi pi-minus-circle',
      trueClass: 'text-green-500',
      falseClass: 'text-surface-300 dark:text-surface-600',
    }, { width: '100px' })

    // Konfiguracja tabeli
    .setPagination(10, [5, 10, 25, 50])
    .setGlobalFilter(['sku', 'name', 'category', 'status'])
    .setEmptyMessage('Nie znaleziono produktów')
    .setSize('small')
    .setSelectionMode('multiple')
  );
}
