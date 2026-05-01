import { Component, signal, OnInit } from '@angular/core';
import { ErpTableComponent, TableContextMenuConfig, TableConfig } from '@erp/shared/ui';

// Wzbogacony model Product dla demonstracji nowych możliwości tabeli
export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  status: 'InStock' | 'LowStock' | 'OutOfStock';
  imageUrl?: string;
}

@Component({
  selector: 'erp-product-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `
    <div class="h-full flex flex-col p-4 bg-slate-50 dark:bg-slate-900">
      <div class="mb-4 flex justify-between items-center">
        <div>
          <h2 class="text-xl font-bold text-slate-800 dark:text-white">Katalog Produktów</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Zarządzaj asortymentem, cenami i stanami magazynowymi.</p>
        </div>
      </div>

      <!-- Smart Tabela -->
      <erp-table
        class="flex-1 shadow-sm"
        [data]="products()"
        [config]="tableConfig()"
        [menuConfig]="tableMenuConfig()"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class ProductTableComponent implements OnInit {
  // Stan komponentu
  public products = signal<Product[]>([]);

  // Konfiguracja Menu Kontekstowego
  public tableMenuConfig = signal<TableContextMenuConfig>({
    globalItems: [
      {
        id: 'add',
        label: 'Dodaj produkt',
        icon: 'pi pi-plus',
      },
    ],
    dynamicItems: [
      {
        id: 'edit',
        label: 'Edytuj',
        icon: 'pi pi-pencil',
        visible: (selection): boolean => selection.rowIds.size === 1,
        command: (selection) => console.log('Edycja:', Array.from(selection.rowIds)[0]),
      },
      {
        id: 'delete',
        label: 'Usuń wybrane',
        icon: 'pi pi-trash',
        visible: (selection): boolean => selection.rowIds.size > 0,
        command: (selection) => console.log('Usuwanie:', Array.from(selection.rowIds)),
      },
    ],
  });

  // Konfiguracja "Smart Tabeli" wykorzystująca nowe funkcje
  public tableConfig = signal<TableConfig<Product>>({
    // Ustawienia wirtualizacji
    virtualScroll: true,
    scrollHeight: '600px',
    rowHover: true,
    
    // Ustawienia selekcji (zaznaczanie wielu wierszy, np. z użyciem Ctrl)
    selection: {
      mode: 'multiple',
      type: 'row',
    },

    // Konfiguracja kolumn
    columns: [
      {
        field: 'imageUrl',
        header: 'Zdjęcie',
        type: 'image',
        width: '60px',
        frozen: true,
        imageConfig: {
          width: '40px',
          height: '40px',
          cssClass: 'rounded-md object-cover shadow-sm border border-slate-200 dark:border-slate-700'
        }
      },
      { 
        field: 'name', 
        header: 'Nazwa Produktu', 
        type: 'text', 
        frozen: true,
        width: '200px'
      },
      { 
        field: 'description', 
        header: 'Opis', 
        type: 'multiline',
        width: '300px'
      },
      { 
        field: 'sku', 
        header: 'SKU', 
        type: 'text',
        width: '120px'
      },
      { 
        field: 'price', 
        header: 'Cena (PLN)', 
        type: 'text',
        width: '120px'
      },
      { 
        field: 'status', 
        header: 'Status', 
        type: 'pill',
        width: '150px',
        pillConfig: {
          getPillOptions: (row) => {
            switch (row.status) {
              case 'InStock': 
                return { value: 'Dostępny', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: 'pi pi-check', tooltip: 'Produkt jest w magazynie' };
              case 'LowStock': 
                return { value: 'Mało sztuk', colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: 'pi pi-exclamation-triangle', tooltip: 'Zostało mniej niż 5 sztuk' };
              case 'OutOfStock': 
                return { value: 'Brak', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: 'pi pi-times', tooltip: 'Produkt niedostępny w magazynie' };
            }
          }
        }
      },
    ],
  });

  public ngOnInit(): void {
    this._loadProducts();
  }

  private _loadProducts(): void {
    // Generowanie większej ilości danych testowych, aby pokazać wirtualizację
    const mockData: Product[] = [
      { 
        id: '1', 
        name: 'Laptop Gamingowy X', 
        description: 'Potężny laptop do gier z najnowszą kartą graficzną i procesorem. \nDoskonały do renderowania.', 
        sku: 'LAP-001', 
        price: 5999,
        status: 'InStock',
        imageUrl: 'https://primefaces.org/cdn/primeng/images/demo/product/bamboo-watch.jpg'
      },
      { 
        id: '2', 
        name: 'Mysz Bezprzewodowa Pro', 
        description: 'Ergonomiczna mysz dla profesjonalistów.', 
        sku: 'MYS-002', 
        price: 350,
        status: 'LowStock',
        imageUrl: 'https://primefaces.org/cdn/primeng/images/demo/product/black-watch.jpg'
      },
      { 
        id: '3', 
        name: 'Monitor 4K Ultra', 
        description: 'Znakomite odwzorowanie kolorów, matryca IPS.', 
        sku: 'MON-003', 
        price: 2100,
        status: 'OutOfStock',
        imageUrl: 'https://primefaces.org/cdn/primeng/images/demo/product/blue-band.jpg'
      },
    ];

    // Powielamy dane, żeby przetestować scrollowanie wirtualne
    const largeMockData = Array.from({ length: 50 }).map((_, i) => ({
      ...mockData[i % 3],
      id: `${i + 1}`,
      sku: `${mockData[i % 3].sku}-${i + 1}`,
      name: `${mockData[i % 3].name} v${Math.floor(i / 3) + 1}`
    }));

    this.products.set(largeMockData);
  }
}
