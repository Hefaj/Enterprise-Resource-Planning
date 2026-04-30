import { Component, signal, OnInit, inject } from '@angular/core';
import { ErpTableComponent, TableContextMenuConfig } from '@erp/shared/ui';
import { TableConfig } from '@erp/shared/ui';

// Zakładam, że model Product istnieje w bibliotece modułu katalogu
export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
}

@Component({
  selector: 'erp-product-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `
    <div class="h-full flex flex-col">
      <erp-table
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
      }
    `,
  ],
})
export class ProductTableComponent implements OnInit {
  // Stan komponentu
  public products = signal<Product[]>([]);

  public tableMenuConfig = signal<TableContextMenuConfig>({
    globalItems: [
      {
        id: '1',
        label: 'AAA',
      },
    ],
    dynamicItems: [
      {
        id: 'A',
        label: 'Dynamiczne',
        showSearch: true,
        visible: (selection): boolean => selection.cells.has('1|name'),
        groupId: '1',
        items: [
          {
            id: 'B2',
            label: 'Dynamiczne rows2',
          },
        ],
      },
      {
        id: 'B',
        label: 'Dynamiczne rows',
        visible: (selection): boolean => selection.rowIds.size > 0,
        groupId: '2',
      },
    ],
  });

  // Konfiguracja tabeli zgodna z modelem ErpTable
  public tableConfig = signal<TableConfig<Product>>({
    columns: [
      { type: 'text', field: 'name', header: 'Nazwa Produktu', editable: true },
      { type: 'text', field: 'sku', header: 'SKU', editable: false },
      { type: 'text', field: 'price', header: 'Cena (PLN)', editable: true },
    ],
    lazy: false,
    // virtualScroll: true,
  });

  public ngOnInit(): void {
    this._loadProducts();
  }

  private _loadProducts(): void {
    // Mock danych - w rzeczywistym scenariuszu wstrzyknij tutaj ProductService
    this.products.set([
      { id: '1', name: 'Laptop Gamingowy', sku: 'LAP-001', price: 5999 },
      { id: '2', name: 'Mysz Bezprzewodowa', sku: 'MYS-002', price: 150 },
      { id: '3', name: 'Monitor 4K', sku: 'MON-003', price: 2100 },
    ]);
  }
}
