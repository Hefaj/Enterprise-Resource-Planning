import { ChangeDetectionStrategy, Component, inject, computed, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  ErpActionToolbarComponent, 
  ErpActionToolbarBuilder, 
  ErpActionToolbarZoneDirective, 
  ErpActionToolbarContextDirective, 
  ErpModalService, 
  ErpSelectionState 
} from '@erp/shared/ui';
import { SET_NAME_MODAL_ID, SET_PRICE_MODAL_ID } from '@erp/catalog/util';
import { BatchCommandOfProductSetNameCommandAndSearchProductRequest, BatchCommandOfProductSetPriceCommandAndSearchProductRequest, SearchProductRequest, ProductVM } from '@erp/catalog/data-access';
import { CatalogProductTableComponent } from '../../components/catalog-product-table/catalog-product-table.component';
import { ProductStore } from '../product.store';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [
    CommonModule, 
    ErpActionToolbarComponent, 
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    CatalogProductTableComponent
  ],
  template: `
    <div class="h-full w-full p-2">
      <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
        <erp-action-toolbar [config]="actionToolbar" />
        <div class="flex-1 overflow-hidden" >
          <erp-catalog-product-table
            stateKey="product-tab-main"
            [filters]="currentFilters()"
            (selectionChange)="onSelectionChange($event)"
            (loadingChange)="store.setLoading($event)"
            class="block h-full"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  private readonly modalService = inject(ErpModalService);
  protected readonly store = inject(ProductStore);

  private readonly productTable = viewChild(CatalogProductTableComponent);

  protected readonly selectionCount = computed(() => this.store.selection()?.selectedItems?.length ?? 0);

  protected readonly dynamicAttributes = signal([
    { id: 'attr-1', label: 'Kolor', data: 'color' },
    { id: 'attr-2', label: 'Rozmiar', data: 'size' },
    { id: 'attr-3', label: 'Materiał', data: 'material' },
  ]);

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('product-tab-toolbar')
      // --- GRUPY DOMYŚLNE ---
      .addDefaultGroup((g) =>
        g
          .setId('crud')
          .setLabel('Akcje')
          .setIcon('@tui.layers')
          .addAction((a) =>
            a
              .setId('add')
              .setLabel('Dodaj nowy produkt')
              .setIcon('@tui.plus')
              .setShortcut('Ctrl+N')
              .setAppearance('success')
              .setFn(() => console.log('Dodaj nowy'))
          )
          .addAction((a) =>
            a
              .setId('duplicate')
              .setLabel('Duplikuj układ')
              .setIcon('@tui.copy')
              .setShortcut('Ctrl+D')
              .setFn(() => console.log('Duplikuj'))
          )
      )
      .addDefaultGroup((g) =>
        g
          .setId('import-export')
          .setLabel('Eksport i Import')
          .setIcon('@tui.download')
          .addAction((a) =>
            a
              .setId('export-csv')
              .setLabel('Eksportuj do CSV')
              .setIcon('@tui.file-text')
              .setFn(() => console.log('Eksport CSV'))
          )
          .addAction((a) =>
            a
              .setId('export-xml')
              .setLabel('Eksportuj do XML')
              .setIcon('@tui.file-code')
              .setFn(() => console.log('Eksport XML'))
          )
          .addAction((a) =>
            a
              .setId('import')
              .setLabel('Importuj z pliku')
              .setIcon('@tui.upload')
              .setSeparator(true) // dodajemy separator nad importem
              .setFn(() => console.log('Import'))
          )
      )
      .addDefaultGroup((g) =>
        g
          .setId('view-options')
          .setLabel('Opcje widoku')
          .setIcon('@tui.eye')
          .addAction((a) =>
            a
              .setId('refresh')
              .setLabel('Odśwież listę')
              .setIcon('@tui.refresh-cw')
              .setShortcut('F5')
              .setAppearance('info')
              .setFn(() => console.log('Odświeżam'))
          )
          .addAction((a) =>
            a
              .setId('view-archived')
              .setLabel('Pokaż produkty archiwalne')
              .setIcon('@tui.archive')
              .setFn(() => console.log('Pokaż archiwalne'))
          )
          .addAction((a) =>
            a
              .setId('extended-view')
              .setLabel('Rozszerzony widok tabeli z dodatkowymi parametrami i zdjęciami')
              .setIcon('@tui.maximize')
              .setFn(() => console.log('Rozszerzony widok'))
          )
      )
      // --- GRUPY ZAZNACZENIA ---
      .addSelectionGroup((g) =>
        g
          .setId('bulk-edit')
          .setLabel('Edycja masowa')
          .setIcon('@tui.pencil')
          .addAction((a) =>
            a
              .setId('set-name')
              .setLabel('Ustaw nazwe')
              .setIcon('@tui.bookmark')
              .setShortcut('Ctrl+E')
              .setFn(() => this.openSetNameModal())
          )
          .addAction((a) =>
            a
              .setId('set-price')
              .setLabel('Ustaw ceny')
              .setIcon('@tui.dollar-sign')
              .setShortcut('Ctrl+P')
              .setFn(() => this.openSetPriceModal())
          )
          .addAction((a) =>
            a
              .setId('set-vat')
              .setLabel('Zmień stawkę VAT')
              .setIcon('@tui.percent')
              .setFn(() => console.log('Zmień VAT'))
          )
      )
      .addSelectionGroup((g) =>
        g
          .setId('bulk-state')
          .setLabel('Status')
          .setIcon('@tui.activity')
          .addAction((a) =>
            a
              .setId('activate')
              .setLabel('Aktywuj zaznaczone')
              .setIcon('@tui.check')
              .setAppearance('success')
              .setFn(() => console.log('Aktywuj'))
          )
          .addAction((a) =>
            a
              .setId('deactivate')
              .setLabel('Dezaktywuj zaznaczone')
              .setIcon('@tui.slash')
              .setAppearance('warning')
              .setFn(() => console.log('Dezaktywuj'))
          )
          .addAction((a) =>
            a
              .setId('generate-labels')
              .setLabel('Generuj etykiety kodów kreskowych dla zaznaczonych produktów')
              .setIcon('@tui.printer')
              .setFn(() => console.log('Generuj etykiety'))
          )
          .addAction((a) =>
            a
              .setId('change-vat')
              .setLabel('Zmień stawkę VAT dla wszystkich zaznaczonych pozycji')
              .setIcon('@tui.percent')
              .setSeparator(true)
              .setFn(() => console.log('Zmień VAT'))
          )
      )
      // --- DYNAMICZNE PROVIDERY ---
      .addDynamicProvider((dp) =>
        dp
          .setGroupId('attributes')
          .setLabel('Zmień atrybut')
          .setIcon('@tui.tag')
          .setItems(this.dynamicAttributes)
          .addTemplateAction((a) =>
            a
              .setId('set-attr')
              .setLabel('Ustaw wartość')
              .setIcon('@tui.pen')
              .setDynamicFn((item) => console.log('Ustaw atrybut dla:', item.label, item.data))
          )
          .addTemplateAction((a) =>
            a
              .setId('clear-attr')
              .setLabel('Wyczyść wartość')
              .setIcon('@tui.trash')
              .setAppearance('warning')
              .setDynamicFn((item) => console.log('Wyczyść atrybut dla:', item.label))
          )
      )
      // --- USTAWIENIA DODATKOWE ---
      .setSelectionCount(this.selectionCount)
      .setSelectionLabel('Wybrano produktów')
      .setOnClearSelection(() => {
         this.store.setSelection({
           mode: 'server',
           isAllSelected: false,
           selectedItems: [],
           selectedIds: []
         } as ErpSelectionState<ProductVM>);
         this.productTable()?.clearSelection();
      })
      .setPinnedActionIds(['add', 'set-name', 'set-price', 'activate'])
      .setEnableContextMenu(true)
  );

  currentFilters = this.store.filters;

  onSelectionChange(state: ErpSelectionState<ProductVM>): void {
    this.store.setSelection(state);
  }

  private openSetPriceModal(): void {
    this.modalService.open<BatchCommandOfProductSetPriceCommandAndSearchProductRequest>(SET_PRICE_MODAL_ID, { products: [] })
      .then(ref => {
        console.log('[ProductTabComponent] Modal opened successfully!', ref);

        ref.closed.then(result => {
          console.log('[ProductTabComponent] Modal closed with result:', result);
        });
      })
      .catch(err => {
        console.error('[ProductTabComponent] Error opening modal:', err);
      });
  }

  private openSetNameModal(): void {
    this.modalService.open<BatchCommandOfProductSetNameCommandAndSearchProductRequest>(SET_NAME_MODAL_ID, { products: [] })
      .then(ref => {
        console.log('[ProductTabComponent] Modal opened successfully!', ref);

        ref.closed.then(result => {
          console.log('[ProductTabComponent] Modal closed with result:', result);
        });
      })
      .catch(err => {
        console.error('[ProductTabComponent] Failed to open modal:', err);
      });
  }
}

