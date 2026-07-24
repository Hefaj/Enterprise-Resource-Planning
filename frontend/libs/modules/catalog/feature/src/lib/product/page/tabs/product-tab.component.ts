import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpMenuBarComponent, ErpMenuBarBuilder, ErpModalService, ErpTableComponent, ErpTableBuilder, ErpTableState, ErpTableConfig } from '@erp/shared/ui';
import { SET_NAME_MODAL_ID, SET_PRICE_MODAL_ID } from '@erp/catalog/util';
import { BatchCommandOfProductSetNameCommand, BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';

/** Pojedynczy atrybut produktu z wieloma możliwymi wartościami. */
interface ProductAttribute {
  name: string;
  values: string[];
}

interface ProductCategory {
  name: string;
  isMain: boolean;
}

interface ProductListDto {
  id: string;
  sku: string;
  name: string;
  categories: ProductCategory[];
  price: number;
  status: string;
  stock: number;
  supplier: string;
  weight: number;
  dimensions: string;
  barcode: string;
  addedDate: string;
  attributes: ProductAttribute[];
}

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
          [config]="tableConfig()"
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

  items = signal<ProductListDto[]>([]);
  totalCount = signal<number>(0);
  loading = signal<boolean>(false);

  /**
   * Konfiguracja tabeli jest dynamiczna (computed), ponieważ kolumny atrybutów
   * zależą od danych — różne produkty mają różne zestawy atrybutów.
   * Po załadowaniu danych, computed przelicza unikalne atrybuty i generuje kolumny.
   */
  tableConfig = computed<ErpTableConfig<ProductListDto>>(() => {
    const data = this.items();
    const uniqueAttributes = this.extractUniqueAttributes(data);

    const builder = new ErpTableBuilder<ProductListDto>()
      .setMode('server')
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(80)
      .setDefaultPageSize(10)
      .setPageSizeOptions([10, 20, 50, 100])
      .setSelectionMode('multi')
      .setItems(this.items)
      .setItemCount(this.totalCount)
      .setLoading(this.loading)

      // ── Identyfikacja ──
      .addColumnGroup(g => g
        .setId('identification')
        .setHeader('Identyfikacja')
        .addColumn(c => c
          .setId('sku')
          .setAccessorKey('sku')
          .setHeader('SKU')
          .setSize(120)
        )
        .addColumn(c => c
          .setId('barcode')
          .setAccessorKey('barcode')
          .setHeader('Kod kreskowy (EAN)')
          .setSize(180)
        )
        .addColumn(c => c
          .setId('name')
          .setAccessorKey('name')
          .setHeader('Nazwa produktu')
          .setSize(250)
        )
      )

      // ── Kategoryzacja i Status ──
      .addColumnGroup(g => g
        .setId('categorization')
        .setHeader('Szczegóły Handlowe')
        .addColumn(c => c
          .setId('categories')
          .setAccessorKey('categories')
          .setHeader('Kategorie')
          .setEnableSorting(false)
          .setSize(160)
          .setCellRichContent((categories: { name: string, isMain: boolean }[]) => ({
            lines: categories.map(cat => ({
              text: cat.name,
              chips: cat.isMain 
                ? [{ 
                    text: 'Kategoria Główna', 
                    shortText: 'Główna', 
                    description: 'Kategoria wiodąca przypisana do tego produktu jako główna oś analizy.',
                    appearance: 'accent', 
                    size: 's' as const
                  }] 
                : undefined
            }))
          }))
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
              cellChips: [{ 
                text: isAvailable ? 'Status aktywny' : (isWithdrawn ? 'Status archiwum' : 'Status oczekujący'), 
                shortText: isAvailable ? 'Aktywny' : (isWithdrawn ? 'Arch.' : 'Oczek.'), 
                description: isAvailable 
                  ? 'Produkt jest obecnie dostępny do sprzedaży.' 
                  : (isWithdrawn ? 'Produkt został wycofany z oferty.' : 'Produkt oczekuje na weryfikację.'),
                appearance: isAvailable ? 'positive' : (isWithdrawn ? 'neutral' : 'warning'),
                size: 's' as const
              }]
            };
          })
        )
        .addColumn(c => c
          .setId('price')
          .setAccessorKey('price')
          .setHeader('Cena (PLN)')
          .setSubHeader('Netto')
          .setSize(120)
        )
      )

      // ── Logistyka i Magazyn ──
      .addColumnGroup(g => g
        .setId('logistics')
        .setHeader('Logistyka i Magazyn')
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
      )

      // ── Systemowe ──
      .addColumnGroup(g => g
        .setId('system')
        .setHeader('Systemowe')
        .addColumn(c => c
          .setId('addedDate')
          .setAccessorKey('addedDate')
          .setHeader('Data dodania')
          .setSize(140)
        )
      );

    // ── Dynamiczne kolumny atrybutów (grupa) ──
    if (uniqueAttributes.length > 0) {
      builder.addColumnGroup(group => {
        group
          .setId('attributes_group')
          .setHeader('Atrybuty');

        for (const attrName of uniqueAttributes) {
          group.addColumn(c => c
            .setId(`attr_${attrName}`)
            .setAccessorFn((row) => {
              const attr = row.attributes?.find((a) => a.name === attrName);
              return attr?.values ?? [];
            })
            .setHeader(attrName)
            .setSize(150)
            .setVisible(false)
            .setEnableSorting(false)
            .setCellRichContent((values: string[]) => {
              if (!values || values.length === 0) return { lines: [{ text: '—' }] };
              return { lines: values.map(v => ({ text: v })) };
            })
          );
        }
      });
    }

    builder
      .setLegendItems([
        {
          text: 'Niestandardowy status',
          shortText: 'Manual',
          description: 'Ten element został dodany do legendy całkowicie ręcznie w kodzie, z pominięciem automatycznego zbierania.',
          appearance: 'destructive'
        }
      ])
      .setOnStateChange(state => this.onTableStateChange(state));

    return builder.build();
  });

  /**
   * Wyciąga unikalne nazwy atrybutów z załadowanych produktów.
   * Zachowuje kolejność pierwszego wystąpienia.
   */
  private extractUniqueAttributes(items: ProductListDto[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of items) {
      if (item.attributes) {
        for (const attr of item.attributes as ProductAttribute[]) {
          if (!seen.has(attr.name)) {
            seen.add(attr.name);
            result.push(attr.name);
          }
        }
      }
    }

    return result;
  }

  onTableStateChange(state: ErpTableState): void {
    this.loading.set(true);
    
    // Symulacja opóźnienia z backendu
    setTimeout(() => {
      let filtered = [...ALL_PRODUCTS];
      
      // Sortowanie po stronie serwera
      if (state.sorting && state.sorting.length > 0) {
        filtered.sort((a, b) => {
          for (const sort of state.sorting) {
            const aVal = (a as any)[sort.columnId];
            const bVal = (b as any)[sort.columnId];
            
            if (aVal < bVal) return sort.direction === 'desc' ? 1 : -1;
            if (aVal > bVal) return sort.direction === 'desc' ? -1 : 1;
          }
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

// ── Generowanie atrybutów testowych ──

const ATTRIBUTE_POOLS: Record<string, { name: string; values: string[] }[]> = {
  Elektronika: [
    { name: 'Pojemność pamięci', values: ['64GB', '128GB', '256GB', '512GB'] },
    { name: 'Kolor', values: ['Czarny', 'Biały', 'Srebrny', 'Grafitowy'] },
    { name: 'Gwarancja', values: ['12 miesięcy', '24 miesiące', '36 miesięcy'] },
    { name: 'Złącza', values: ['USB-C', 'HDMI', 'DisplayPort', 'Thunderbolt'] },
  ],
  Meble: [
    { name: 'Materiał', values: ['Drewno dębowe', 'Drewno sosnowe', 'MDF', 'Stal'] },
    { name: 'Kolor', values: ['Naturalny', 'Biały', 'Orzech', 'Antracyt'] },
    { name: 'Styl', values: ['Skandynawski', 'Industrialny', 'Klasyczny'] },
  ],
  Narzędzia: [
    { name: 'Materiał', values: ['Stal nierdzewna', 'Stal węglowa', 'Tytan'] },
    { name: 'Rozmiar', values: ['S', 'M', 'L', 'XL'] },
    { name: 'Certyfikat', values: ['CE', 'ISO 9001'] },
  ],
  Odzież: [
    { name: 'Rozmiar ramy', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Kolor', values: ['Czerwony', 'Niebieski', 'Zielony', 'Czarny', 'Biały'] },
    { name: 'Materiał', values: ['Bawełna', 'Poliester', 'Len', 'Wełna'] },
    { name: 'Sezon', values: ['Wiosna/Lato', 'Jesień/Zima', 'Całoroczny'] },
  ],
};

function generateAttributes(index: number): ProductAttribute[] {
  const categoryName = ['Elektronika', 'Meble', 'Narzędzia', 'Odzież'][index % 4];
  const pool = ATTRIBUTE_POOLS[categoryName];
  if (!pool) return [];

  // Każdy produkt dostaje 2-3 atrybuty z puli swojej kategorii (z losowym podzbiorem wartości)
  const attrCount = 2 + (index % 2); // 2 lub 3 atrybuty
  const attrs: ProductAttribute[] = [];

  for (let i = 0; i < attrCount && i < pool.length; i++) {
    const attrTemplate = pool[(index + i) % pool.length];
    // Losowy podzbiór wartości (1 do max)
    const valueCount = 1 + ((index + i) % attrTemplate.values.length);
    const values = attrTemplate.values.slice(0, valueCount);
    attrs.push({ name: attrTemplate.name, values });
  }

  return attrs;
}

// Dummy dane symulujące bazę danych na backendzie
const ALL_PRODUCTS: ProductListDto[] = Array.from({ length: 250 }, (_, i) => ({
  id: `P-${String(i + 1).padStart(4, '0')}`,
  sku: `SKU-${10000 + i}`,
  name: `Produkt Testowy ${i + 1}`,
  categories: [
    { name: ['Elektronika', 'Meble', 'Narzędzia', 'Odzież'][i % 4], isMain: true },
    { name: ['Wyprzedaż', 'Nowości', 'Polecane', 'Bestsellery'][(i + 1) % 4], isMain: false },
    ...(i % 3 === 0 ? [{ name: 'Ostatnie sztuki', isMain: false }] : []),
    // Skrajny przypadek: co dziesiąty produkt ma kilkanaście kategorii
    ...(i % 10 === 0 ? Array.from({ length: 15 }, (_, j) => ({ name: `Podkategoria Atrybutu ${j + 1}`, isMain: false })) : [])
  ],
  price: 99.99 + (i * 2.5),
  status: ['Dostępny', 'Niedostępny', 'Wycofany'][i % 3],
  stock: i % 2 === 0 ? i * 2 : 0,
  supplier: ['TechCorp', 'FurniPOL', 'BuildMax', 'CottonCo'][i % 4],
  weight: parseFloat((Math.random() * 50).toFixed(2)),
  dimensions: `${Math.floor(Math.random() * 100)}x${Math.floor(Math.random() * 100)}x${Math.floor(Math.random() * 100)}`,
  barcode: `590${Math.floor(1000000000 + Math.random() * 9000000000)}`,
  addedDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  attributes: generateAttributes(i),
}));
