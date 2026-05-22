import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  WritableSignal,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import {
  ErpTableComponent,
  ErpTableBuilder,
  ErpTableColumn,
  ErpTableFilters,
  ErpTableLazyEvent,
} from '@erp/shared/ui/erp-table';

/**
 * Biznesowy komponent tabeli produktów.
 *
 * Łączy:
 * - Stałe kolumny produktowe (miniatura, SKU, nazwa, kategoria, cena, status, dostępność)
 * - Dynamiczne kolumny atrybutów (przekazywane z zewnątrz przez `attributeColumns`)
 *
 * Obsługuje wirtualny scroll w obu osiach, lazy loading i context menu.
 */
@Component({
  selector: 'catalog-product-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `
    <erp-table [config]="tableConfig()" />
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTableComponent {
  /** Dane produktów do wyświetlenia */
  public data = input<any[]>([]);

  /** Filtry zewnętrzne (np. z globalnego panelu ErpDynamicFilter) */
  public externalFilters = input<ErpTableFilters>({});

  /** Stan ładowania */
  public loading = input<boolean>(false);

  /** Łączna liczba rekordów (dla lazy load w trybie wirtualnym) */
  public totalRecords = input<number>(0);

  /**
   * Dynamiczne kolumny atrybutów produktu.
   * Każdy produkt może mieć inny zestaw atrybutów –
   * ta lista to unia wszystkich kluczy atrybutów ze wszystkich produktów.
   */
  public attributeColumns = input<ErpTableColumn[]>([]);

  /**
   * Elementy context menu (PPM).
   * Smart component przekazuje menu reagujące na aktualną selekcję.
   */
  public contextMenuItems = input<MenuItem[]>([]);

  /**
   * WritableSignal selekcji z zewnątrz (smart component).
   * Tabela zapisuje tu zaznaczone wiersze; smart component czyta reaktywnie.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public selectionSignal = input<WritableSignal<any[]> | undefined>(undefined);

  /** Emitowany gdy tabela potrzebuje nowych danych (scroll, sort) */
  public lazyLoad = output<ErpTableLazyEvent>();

  /** Stałe kolumny specyficzne dla produktu */
  private readonly staticColumns: ErpTableColumn[] = [
    // Miniatura
    {
      field: 'image',
      header: '',
      type: 'image',
      typeConfig: { width: '40px', height: '40px', rounded: false, fallbackIcon: 'pi pi-box' },
      width: '70px',
    },
    // SKU
    {
      field: 'sku',
      header: 'SKU',
      sortable: true,
      width: '130px',
    },
    // Nazwa produktu (link)
    {
      field: 'name',
      header: 'Nazwa produktu',
      type: 'link',
      typeConfig: { onClick: (row) => console.log('Otwórz produkt:', row) },
      sortable: true,
      minWidth: '250px',
    },
    // Kategoria
    {
      field: 'category',
      header: 'Kategoria',
      sortable: true,
      width: '180px',
    },
    // Cena netto
    {
      field: 'price',
      header: 'Cena netto',
      sortable: true,
      align: 'right',
      pipe: 'currency',
      width: '160px',
    },
    // Data dostępności
    {
      field: 'availableFrom',
      header: 'Dostępny od',
      sortable: true,
      pipe: 'date',
      width: '150px',
    },
    // Status
    {
      field: 'status',
      header: 'Status',
      type: 'badge',
      typeConfig: {
        severityMap: {
          'Aktywny': 'success',
          'Draft': 'warn',
          'Wycofany': 'danger',
          'Archiwum': 'secondary',
        },
      },
      sortable: true,
      width: '130px',
    },
    // Dostępność
    {
      field: 'available',
      header: 'Dostępny',
      type: 'boolean',
      typeConfig: {
        trueIcon: 'pi pi-check-circle',
        falseIcon: 'pi pi-minus-circle',
        trueClass: 'text-green-500',
        falseClass: 'text-surface-300 dark:text-surface-600',
      },
      width: '100px',
    },
  ];

  /**
   * Połączone kolumny: statyczne + dynamiczne atrybuty.
   * computed() zapewnia reaktywną aktualizację gdy lista atrybutów się zmienia.
   */
  private allColumns = computed<ErpTableColumn[]>(() => [
    ...this.staticColumns,
    ...this.attributeColumns(),
  ]);

  /** Reaktywna konfiguracja tabeli */
  protected tableConfig = computed(() => {
    const builder = new ErpTableBuilder();

    builder
      .setColumns(this.allColumns())
      .setData(this.data)
      .setExternalFilters(this.externalFilters)
      .setLoading(this.loading)
      .setTotalRecords(this.totalRecords)
      .setVirtualScroll(45, 50)
      .setLazyLoad((event) => this.lazyLoad.emit(event))
      .setGlobalFilter(['sku', 'name', 'category', 'status'])
      .setEmptyMessage('Nie znaleziono produktów')
      .setSize('small')
      .setSelectionMode('multiple')
      .setContextMenuItems(this.contextMenuItems);

    const sel = this.selectionSignal();
    if (sel) builder.setSelection(sel);

    return builder.build();
  });
}

