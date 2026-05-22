import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ProductTableComponent } from '@erp/catalog/ui';
import { ErpTableColumn, ErpTableLazyEvent } from '@erp/shared/ui/erp-table';

import { EditEanModalComponent } from '../../modal';
import { EditSkuModalComponent } from '../../modal';
import { EditStatusModalComponent } from '../../modal';

// ── Mock data generator (zastąpić wywołaniem CatalogBffClient) ──

const STATIC_ATTR_KEYS = ['color', 'weight', 'dimensions', 'material', 'brand', 'warranty'];
const PRODUCT_STATUSES = ['Aktywny', 'Draft', 'Wycofany', 'Archiwum'];
const CATEGORIES = ['Elektronika', 'Dom i Ogród', 'Sport', 'Moda', 'Zabawki'];

function generateMockProducts(offset: number, count: number): any[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = offset + i;
    const attrs: Record<string, string> = {};
    STATIC_ATTR_KEYS.forEach((key) => {
      attrs[`attr_${key}`] = `${key}-value-${idx}`;
    });
    return {
      uuid: `uuid-${idx}`,
      image: null,
      sku: `SKU-${String(idx).padStart(5, '0')}`,
      name: `Produkt testowy nr ${idx + 1}`,
      category: CATEGORIES[idx % CATEGORIES.length],
      price: parseFloat((Math.random() * 5000 + 10).toFixed(2)),
      availableFrom: new Date(2024, idx % 12, (idx % 28) + 1),
      status: PRODUCT_STATUSES[idx % PRODUCT_STATUSES.length],
      available: idx % 3 !== 0,
      ean: `590${String(idx).padStart(10, '0')}`,
      ...attrs,
    };
  });
}

function generateMockAttributeColumns(): ErpTableColumn[] {
  return STATIC_ATTR_KEYS.map((key) => ({
    field: `attr_${key}`,
    header: key.charAt(0).toUpperCase() + key.slice(1),
    sortable: false,
    width: '140px',
  }));
}

const PAGE_SIZE = 50;
const TOTAL_MOCK_RECORDS = 10_000;

/**
 * Smart component zakładki "Produkty".
 * Zarządza stanem: ładowaniem danych, selekcją, dynamicznymi kolumnami i context menu.
 */
@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ProductTableComponent, DynamicDialogModule],
  providers: [DialogService],
  template: `
    <div class="tab-container">
      <catalog-product-table
        [data]="products()"
        [loading]="loading()"
        [totalRecords]="totalRecords()"
        [attributeColumns]="attributeColumns()"
        [contextMenuItems]="contextMenuItems()"
        [selectionSignal]="selectionSignal"
        (lazyLoad)="onLazyLoad($event)"
      />
    </div>
  `,
  styles: [`
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
export class ProductTabComponent implements OnInit {
  private dialogService = inject(DialogService);

  // ── State ──

  /** Aktualnie załadowane produkty – pre-alokowana tablica dla virtual scroll */
  protected products = signal<any[]>(Array.from({ length: TOTAL_MOCK_RECORDS }));

  /** Stan ładowania */
  protected loading = signal(false);

  /** Łączna liczba rekordów (do virtual scroll) */
  protected totalRecords = signal(TOTAL_MOCK_RECORDS);

  /** Dynamiczne kolumny atrybutów (pobrane jednorazowo ze schematu) */
  protected attributeColumns = signal<ErpTableColumn[]>([]);

  /**
   * WritableSignal selekcji – przekazywany do ProductTableComponent przez [selectionSignal].
   * Tabela zapisuje tu zaznaczone wiersze; smart component czyta reaktywnie.
   */
  protected readonly selectionSignal: WritableSignal<any[]> = signal<any[]>([]);

  // ── Context menu (reaktywne – zależy od selekcji) ──

  protected contextMenuItems = computed<MenuItem[]>(() => {
    const sel = this.selectionSignal();
    if (sel.length === 0) return [];

    return [
      {
        label: `Edytuj EAN${sel.length > 1 ? ` (${sel.length})` : ''}`,
        icon: 'pi pi-barcode',
        command: () => this.openEditEanModal(),
      },
      {
        label: `Edytuj SKU${sel.length > 1 ? ` (${sel.length})` : ''}`,
        icon: 'pi pi-tag',
        command: () => this.openEditSkuModal(),
      },
      {
        label: `Zmień status${sel.length > 1 ? ` (${sel.length})` : ''}`,
        icon: 'pi pi-sync',
        command: () => this.openEditStatusModal(),
      },
      { separator: true },
      {
        label: 'Odznacz wszystkie',
        icon: 'pi pi-times',
        command: () => this.selectionSignal.set([]),
      },
    ];
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    // Jednorazowe pobranie schematu atrybutów
    this.loadAttributeSchema();
  }

  // ── Data loading ──

  protected onLazyLoad(event: ErpTableLazyEvent): void {
    this.loadProducts(event.first, event.rows);
  }

  private loadProducts(offset: number, count: number): void {
    if (this.loading()) return;

    this.loading.set(true);

    // TODO: zastąpić wywołaniem CatalogBffClient.getProduct({ page, pageSize })
    setTimeout(() => {
      const newItems = generateMockProducts(offset, Math.min(count, TOTAL_MOCK_RECORDS - offset));

      this.products.update((prev) => {
        const merged = [...prev];
        if (merged.length < TOTAL_MOCK_RECORDS) {
          merged.length = TOTAL_MOCK_RECORDS;
        }
        newItems.forEach((item, i) => {
          merged[offset + i] = item;
        });
        return merged;
      });

      this.loading.set(false);
    }, 300);
  }

  private loadAttributeSchema(): void {
    // TODO: zastąpić wywołaniem CatalogBffClient.getModel()
    // Na razie zwracamy statyczny mock schematu
    setTimeout(() => {
      this.attributeColumns.set(generateMockAttributeColumns());
    }, 100);
  }

  // ── Modalne edytory ──

  protected openEditEanModal(): void {
    const products = this.selectionSignal();
    if (products.length === 0) return;

    this.dialogService.open(EditEanModalComponent, {
      header: 'Edytuj kod EAN',
      width: '460px',
      modal: true,
      closable: true,
      data: {
        products: products.map((p) => ({ uuid: p.uuid, sku: p.sku, ean: p.ean })),
        onSave: async (uuid: string, ean: string) => {
          // TODO: CatalogBffClient.updateEan({ uuid, ean })
          console.log('[API] PATCH /product/ean →', { uuid, ean });
        },
      },
    });
  }

  protected openEditSkuModal(): void {
    const products = this.selectionSignal();
    if (products.length === 0) return;

    this.dialogService.open(EditSkuModalComponent, {
      header: 'Edytuj kod SKU',
      width: '460px',
      modal: true,
      closable: true,
      data: {
        products: products.map((p) => ({ uuid: p.uuid, sku: p.sku })),
        onSave: async (uuid: string, sku: string) => {
          // TODO: CatalogBffClient.updateSku({ uuid, sku })
          console.log('[API] PATCH /product/sku →', { uuid, sku });
        },
      },
    });
  }

  protected openEditStatusModal(): void {
    const products = this.selectionSignal();
    if (products.length === 0) return;

    this.dialogService.open(EditStatusModalComponent, {
      header: 'Zmień status produktu',
      width: '480px',
      modal: true,
      closable: true,
      data: {
        products: products.map((p) => ({ uuid: p.uuid, sku: p.sku, status: p.status })),
        onSave: async (uuid: string, status: string) => {
          // TODO: CatalogBffClient.updateStatus({ uuid, status })
          console.log('[API] PATCH /product/status →', { uuid, status });
        },
      },
    });
  }
}
