import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ProductTableComponent } from '@erp/catalog/ui';
import { ErpTableColumn, ErpTableLazyEvent } from '@erp/shared/ui';
import { CatalogProductOrchestrator } from '@erp/catalog/data-access';
import { ProductViewModel } from '@erp/catalog/util';

import { EditEanModalComponent } from '../../modal';
import { EditSkuModalComponent } from '../../modal';
import { EditStatusModalComponent } from '../../modal';

const STATIC_ATTR_KEYS = ['color', 'weight', 'dimensions', 'material', 'brand', 'warranty'];

function generateMockAttributeColumns(): ErpTableColumn[] {
  return STATIC_ATTR_KEYS.map((key) => ({
    field: `attr_${key}`,
    header: key.charAt(0).toUpperCase() + key.slice(1),
    sortable: false,
    width: '140px',
  }));
}

const PAGE_SIZE = 50;

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
  private readonly _dialogService = inject(DialogService);
  private readonly _productOrchestrator = inject(CatalogProductOrchestrator);

  // ── State ──

  /** List of UUIDs returned by search filters */
  protected readonly searchedUuids = signal<string[]>([]);

  /** Stan ładowania */
  protected readonly loading = signal(false);

  /** Łączna liczba rekordów (do virtual scroll) */
  protected readonly totalRecords = computed(() => this.searchedUuids().length);

  /** Aktualnie załadowane produkty z orkiestratora na podstawie pasujących UUIDs */
  protected readonly products = computed<ProductViewModel[]>(() => {
    const uuids = this.searchedUuids();
    const allVms = this._productOrchestrator.allViewModels();
    
    return uuids.map(uuid => {
      const vm = allVms.get(uuid);
      if (vm) return vm;
      
      // Return a skeleton/placeholder object for unloaded row
      return {
        uuid,
        name: 'Ładowanie...',
        sku: '',
        price: 0,
        status: '',
        available: false,
        ean: '',
        category: '',
        modelName: '',
        categoryUuids: [],
        categories: []
      } as unknown as ProductViewModel;
    });
  });

  /** Dynamiczne kolumny atrybutów (pobrane jednorazowo ze schematu) */
  protected readonly attributeColumns = signal<ErpTableColumn[]>([]);

  /**
   * WritableSignal selekcji – przekazywany do ProductTableComponent przez [selectionSignal].
   * Tabela zapisuje tu zaznaczone wiersze; smart component czyta reaktywnie.
   */
  protected readonly selectionSignal: WritableSignal<ProductViewModel[]> = signal<ProductViewModel[]>([]);

  // ── Context menu (reaktywne – zależy od selekcji) ──

  protected readonly contextMenuItems = computed<MenuItem[]>(() => {
    const sel = this.selectionSignal();
    if (sel.length === 0) return [];

    return [
      {
        label: `Edytuj EAN${sel.length > 1 ? ` (${sel.length})` : ''}`,
        icon: 'pi pi-barcode',
        command: (): void => this.openEditEanModal(),
      },
      {
        label: `Edytuj SKU${sel.length > 1 ? ` (${sel.length})` : ''}`,
        icon: 'pi pi-tag',
        command: (): void => this.openEditSkuModal(),
      },
      {
        label: `Zmień status${sel.length > 1 ? ` (${sel.length})` : ''}`,
        icon: 'pi pi-sync',
        command: (): void => this.openEditStatusModal(),
      },
      { separator: true },
      {
        label: 'Odznacz wszystkie',
        icon: 'pi pi-times',
        command: (): void => this.selectionSignal.set([]),
      },
    ];
  });

  // ── Lifecycle ──

  public ngOnInit(): void {
    this._loadAttributeSchema();
    this._triggerSearch();
  }

  // ── Data loading ──

  protected onLazyLoad(event: ErpTableLazyEvent): void {
    this._loadProducts(event.first, event.rows);
  }

  private _triggerSearch(): void {
    this.loading.set(true);
    this._productOrchestrator.search({}).subscribe({
      next: (uuids) => {
        this.searchedUuids.set(uuids);
        this.loading.set(false);
        // Initially load the first page if there are UUIDs
        if (uuids.length > 0) {
          this._loadProducts(0, PAGE_SIZE);
        }
      },
      error: (err) => {
        console.error('Failed to search products:', err);
        this.loading.set(false);
      }
    });
  }

  private _loadProducts(offset: number, count: number): void {
    const uuids = this.searchedUuids();
    if (uuids.length === 0) return;

    const slice = uuids.slice(offset, offset + count);
    
    // Check which ones are already loaded in allViewModels
    const allVms = this._productOrchestrator.allViewModels();
    const toLoad = slice.filter(uuid => !allVms.has(uuid));

    if (toLoad.length === 0) return;

    this.loading.set(true);
    this._productOrchestrator.load(toLoad, { includeCategory: true, includeModel: true }).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.loading.set(false);
      }
    });
  }

  private _loadAttributeSchema(): void {
    setTimeout(() => {
      this.attributeColumns.set(generateMockAttributeColumns());
    }, 100);
  }

  // ── Modalne edytory ──

  protected openEditEanModal(): void {
    const products = this.selectionSignal();
    if (products.length === 0) return;

    this._dialogService.open(EditEanModalComponent, {
      header: 'Edytuj kod EAN',
      width: '460px',
      modal: true,
      closable: true,
      data: {
        products: products.map((p) => ({ uuid: p.uuid, sku: p.sku, ean: p.ean })),
        onSave: async (uuid: string, ean: string) => {
          const allVms = this._productOrchestrator.allViewModels();
          const p = allVms.get(uuid);
          if (p) {
            this._productOrchestrator.updateProduct({ ...p, ean }).subscribe();
          }
          console.log('[API] PATCH /product/ean →', { uuid, ean });
        },
      },
    });
  }

  protected openEditSkuModal(): void {
    const products = this.selectionSignal();
    if (products.length === 0) return;

    this._dialogService.open(EditSkuModalComponent, {
      header: 'Edytuj kod SKU',
      width: '460px',
      modal: true,
      closable: true,
      data: {
        products: products.map((p) => ({ uuid: p.uuid, sku: p.sku })),
        onSave: async (uuid: string, sku: string) => {
          const allVms = this._productOrchestrator.allViewModels();
          const p = allVms.get(uuid);
          if (p) {
            this._productOrchestrator.updateProduct({ ...p, sku }).subscribe();
          }
          console.log('[API] PATCH /product/sku →', { uuid, sku });
        },
      },
    });
  }

  protected openEditStatusModal(): void {
    const products = this.selectionSignal();
    if (products.length === 0) return;

    this._dialogService.open(EditStatusModalComponent, {
      header: 'Zmień status produktu',
      width: '480px',
      modal: true,
      closable: true,
      data: {
        products: products.map((p) => ({ uuid: p.uuid, sku: p.sku, status: p.status })),
        onSave: async (uuid: string, status: string) => {
          const allVms = this._productOrchestrator.allViewModels();
          const p = allVms.get(uuid);
          if (p) {
            this._productOrchestrator.updateProduct({ ...p, status }).subscribe();
          }
          console.log('[API] PATCH /product/status →', { uuid, status });
        },
      },
    });
  }
}
