import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpMenuBarComponent, ErpMenuBarBuilder, ErpModalService, ErpTableComponent, ErpTableBuilder } from '@erp/shared/ui';
import { SET_NAME_MODAL_ID, SET_PRICE_MODAL_ID } from '@erp/catalog/util';
import { BatchCommandOfProductSetNameCommand, BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpMenuBarComponent, ErpTableComponent],
  template: `
    <div class="flex flex-col h-full w-full">
      <erp-menu-bar [config]="horizontalMenu" />
      <div class="flex-1 p-4 overflow-hidden">
        <erp-table 
          class="block h-full"
          [config]="tableConfig"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  private readonly modalService = inject(ErpModalService);

  protected readonly horizontalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .addItem((i) =>
        i
          .setLabel('Produkt aktywny')
          .setFn(() => {
            console.log('Kliknieto');
          })
       )
      .addSeparator()
      .addItem((i) =>
        i
          .setLabel('Ustaw nazwe')
          .setIconStart('@tui.bookmark')
          .setFn(() => this.openSetNameModal())
      )
      .addItem((i) =>
        i
          .setLabel('Ustaw ceny')
          .setIconStart('@tui.dollar-sign')
          .setFn(() => this.openSetPriceModal())
      )
  );

  items = signal<any[]>([]);
  totalCount = signal<number>(0);
  loading = signal<boolean>(false);

  tableConfig = new ErpTableBuilder<any>()
    .setMode('server')
    .setEnableVirtualScroll(true)
    .setEstimatedRowHeight(80)
    .setDefaultPageSize(10)
    .setPageSizeOptions([10, 20, 50, 100])
    .setSelectionMode('multi')
    .setItems(this.items)
    .setItemCount(this.totalCount)
    .setLoading(this.loading)
    .addColumn(c => c
      .setId('sku')
      .setAccessorKey('sku')
      .setHeader('SKU')
      .setPin('left')
      .setSize(120)
    )
    .addColumn(c => c
      .setId('name')
      .setAccessorKey('name')
      .setHeader('Nazwa produktu')
      .setSize(250)
    )
    .addColumn(c => c
      .setId('categories')
      .setAccessorKey('categories')
      .setHeader('Kategorie')
      .setSize(160)
      .setCellRichContent((categories: { name: string, isMain: boolean }[]) => ({
        lines: categories.map(cat => ({
          text: cat.name,
          badges: cat.isMain 
            ? [{ text: 'Główna', appearance: 'accent', size: 's' }] 
            : undefined
        }))
      }))
    )
    .addColumn(c => c
      .setId('price')
      .setAccessorKey('price')
      .setHeader('Cena (PLN)')
      .setSubHeader('Netto')
      .setSize(120)
    )
    .addColumn(c => c
      .setId('status')
      .setAccessorKey('status')
      .setHeader('Status')
      .setSize(130)
      .setCellRichContent((status: string) => {
        const isAvailable = status === 'Dostępny';
        const isWithdrawn = status === 'Wycofany';
        return {
          lines: [{ text: status }],
          cellBadges: [{ 
            text: isAvailable ? 'Aktywny' : (isWithdrawn ? 'Archiwum' : 'Oczekujący'), 
            appearance: isAvailable ? 'positive' : (isWithdrawn ? 'neutral' : 'warning'),
            size: 's' 
          }]
        };
      })
    )
    .addColumn(c => c
      .setId('stock')
      .setAccessorKey('stock')
      .setHeader('Stan magazynowy')
      .setSize(150)
    )
    .addColumn(c => c
      .setId('supplier')
      .setAccessorKey('supplier')
      .setHeader('Dostawca')
      .setSize(180)
    )
    .addColumn(c => c
      .setId('weight')
      .setAccessorKey('weight')
      .setHeader('Waga (kg)')
      .setSize(110)
    )
    .addColumn(c => c
      .setId('dimensions')
      .setAccessorKey('dimensions')
      .setHeader('Wymiary (cm)')
      .setSize(140)
    )
    .addColumn(c => c
      .setId('barcode')
      .setAccessorKey('barcode')
      .setHeader('Kod kreskowy (EAN)')
      .setSize(180)
    )
    .addColumn(c => c
      .setId('addedDate')
      .setAccessorKey('addedDate')
      .setHeader('Data dodania')
      .setSize(140)
    )
    .setOnStateChange(state => this.onTableStateChange(state))
    .build();

  onTableStateChange(state: any): void {
    this.loading.set(true);
    
    // Symulacja opóźnienia z backendu
    setTimeout(() => {
      let filtered = [...ALL_PRODUCTS];
      
      // Sortowanie po stronie serwera
      if (state.sorting && state.sorting.length > 0) {
        const sort = state.sorting[0];
        filtered.sort((a: any, b: any) => {
          const aVal = a[sort.id];
          const bVal = b[sort.id];
          if (aVal < bVal) return sort.desc ? 1 : -1;
          if (aVal > bVal) return sort.desc ? -1 : 1;
          return 0;
        });
      }

      // Paginacja po stronie serwera
      const pageIndex = state.pagination.pageIndex;
      const pageSize = state.pagination.pageSize;
      const paged = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

      this.items.set(paged);
      this.totalCount.set(filtered.length);
      this.loading.set(false);
    }, 500); 
  }

  private openSetPriceModal(): void {
    this.modalService.open<BatchCommandOfProductSetPriceCommand>(SET_PRICE_MODAL_ID, { products: [] })
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
    this.modalService.open<BatchCommandOfProductSetNameCommand>(SET_NAME_MODAL_ID, { products: [] })
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

// Dummy dane symulujące bazę danych na backendzie
const ALL_PRODUCTS = Array.from({ length: 250 }, (_, i) => ({
  id: `P-${String(i + 1).padStart(4, '0')}`,
  sku: `SKU-${10000 + i}`,
  name: `Produkt Testowy ${i + 1}`,
  categories: [
    { name: ['Elektronika', 'Meble', 'Narzędzia', 'Odzież'][i % 4], isMain: true },
    { name: ['Wyprzedaż', 'Nowości', 'Polecane', 'Bestsellery'][(i + 1) % 4], isMain: false },
    ...(i % 3 === 0 ? [{ name: 'Ostatnie sztuki', isMain: false }] : [])
  ],
  price: 99.99 + (i * 2.5),
  status: ['Dostępny', 'Niedostępny', 'Wycofany'][i % 3],
  stock: i % 2 === 0 ? i * 2 : 0,
  supplier: ['TechCorp', 'FurniPOL', 'BuildMax', 'CottonCo'][i % 4],
  weight: parseFloat((Math.random() * 50).toFixed(2)),
  dimensions: `${Math.floor(Math.random() * 100)}x${Math.floor(Math.random() * 100)}x${Math.floor(Math.random() * 100)}`,
  barcode: `590${Math.floor(1000000000 + Math.random() * 9000000000)}`,
  addedDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
}));
