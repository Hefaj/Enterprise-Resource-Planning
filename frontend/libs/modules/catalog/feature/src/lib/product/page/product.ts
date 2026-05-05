import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  ErpPageLayoutComponent, 
  ErpDynamicFilterComponent, 
  ErpDynamicFilterBuilder, 
  ErpTreeSelectComponent,
  ErpFormBuilder, 
  ErpInputTextBuilder, 
  ErpSelectBuilder, 
  ErpDatePickerBuilder, 
  ErpCardComponent, 
  ErpCardBuilder,
  ErpButtonBuilder,
  ErpActionButtonsComponent,
  ErpFormComponent,
  ErpTreeSelectBuilder,
  ErpTabsComponent,
  ErpTabsBuilder,
  ErpTableComponent,
  ErpTableBuilder
} from '@erp/shared/ui';

import { ProductFlowComponent } from './product-flow/product-flow.component';
import { TreeNode } from 'primeng/api';

@Component({
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent, ErpDynamicFilterComponent, ErpTabsComponent, ErpTableComponent, ProductFlowComponent, ErpCardComponent],
  template: `
    <erp-page-layout>
      <!-- Lewy panel: Filtry -->
      <div filters>
        <erp-dynamic-filter [config]="filtersConfig" (filterSubmit)="onFilter()" />
      </div>

      <!-- Kontent -->
      <div class="h-full">
        <erp-tabs [config]="tabsConfig" [(value)]="activeTab">
          <!-- Placeholdery dla zakładek bez komponentów -->
          @if (activeTab() === '2') {
            <div class="h-full flex items-center justify-center border-2 border-dashed border-orange-200 dark:border-orange-900/50 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 text-orange-400 dark:text-orange-500">
              Stany Magazynowe (Zakładka 2)
            </div>
          } @else if (activeTab() === '3') {
            <div class="h-full flex items-center justify-center border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-2xl bg-surface-50/50 dark:bg-surface-800/20 text-surface-400 dark:text-surface-500">
              Historia zmian (Zakładka 3)
            </div>
          }
        </erp-tabs>
      </div>
    </erp-page-layout>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  public activeTab = signal<string | number | undefined>('0');

  // ── Dane testowe produktów ──
  protected readonly products = signal([
    { sku: 'ELE-001', name: 'Laptop ProMax 16"', category: 'Elektronika', price: 5499.99, availableFrom: new Date('2024-03-15'), status: 'Aktywny' },
    { sku: 'ELE-002', name: 'Monitor UltraWide 34"', category: 'Elektronika', price: 2899.00, availableFrom: new Date('2024-01-20'), status: 'Aktywny' },
    { sku: 'DOM-001', name: 'Fotel Ergonomiczny ErgoPlus', category: 'Dom i Ogród', price: 1299.00, availableFrom: new Date('2024-06-01'), status: 'Wycofany' },
    { sku: 'ELE-003', name: 'Klawiatura Mechaniczna RGB', category: 'Elektronika', price: 449.99, availableFrom: new Date('2024-02-10'), status: 'Aktywny' },
    { sku: 'DOM-002', name: 'Biurko Standing Desk 180cm', category: 'Dom i Ogród', price: 2199.00, availableFrom: new Date('2024-04-22'), status: 'Aktywny' },
    { sku: 'ELE-004', name: 'Słuchawki Noise-Cancel Pro', category: 'Elektronika', price: 899.00, availableFrom: new Date('2024-05-05'), status: 'Draft' },
    { sku: 'DOM-003', name: 'Lampa LED Biurkowa Smart', category: 'Dom i Ogród', price: 199.99, availableFrom: new Date('2024-07-12'), status: 'Aktywny' },
    { sku: 'ELE-005', name: 'Mysz Bezprzewodowa Ergo', category: 'Elektronika', price: 249.00, availableFrom: new Date('2024-08-01'), status: 'Aktywny' },
    { sku: 'DOM-004', name: 'Organizator Kabli Premium', category: 'Dom i Ogród', price: 79.99, availableFrom: new Date('2024-03-28'), status: 'Wycofany' },
    { sku: 'ELE-006', name: 'Webcam 4K HDR', category: 'Elektronika', price: 599.00, availableFrom: new Date('2024-09-15'), status: 'Draft' },
    { sku: 'DOM-005', name: 'Mata Antyzmęczeniowa 100x60', category: 'Dom i Ogród', price: 149.00, availableFrom: new Date('2024-01-05'), status: 'Aktywny' },
    { sku: 'ELE-007', name: 'Hub USB-C 12w1 Pro', category: 'Elektronika', price: 349.00, availableFrom: new Date('2024-10-01'), status: 'Aktywny' },
  ]);

  // ── Konfiguracja tabeli ──
  protected readonly tableConfig = ErpTableBuilder.create(b => b
    .addColumn('sku', 'SKU', { sortable: true, width: '130px', filterable: true })
    .addColumn('name', 'Nazwa produktu', { sortable: true, filterable: true, minWidth: '250px' })
    .addColumn('category', 'Kategoria', { sortable: true, filterable: true, width: '180px' })
    .addColumn('price', 'Cena netto', { sortable: true, align: 'right', pipe: 'currency', width: '160px' })
    .addColumn('availableFrom', 'Dostępny od', { sortable: true, pipe: 'date', width: '150px' })
    .addColumn('status', 'Status', { sortable: true, width: '120px' })
    .setPagination(10, [5, 10, 25])
    .setGlobalFilter(['sku', 'name', 'category', 'status'])
    .setEmptyMessage('Nie znaleziono produktów')
    .setSize('small')
    .onRowSelect(row => console.log('Wybrany produkt:', row))
  );

  private rootPage = 0;
  private childrenPageMap = new Map<string, number>();

  private loadMoreNode(parentNode: TreeNode | null): TreeNode {
    return { 
      key: parentNode ? `${parentNode.key}-load-more` : 'root-load-more', 
      data: { isLoadMore: true, parentNode: parentNode }, 
      selectable: false 
    };
  }

  private generateRootPage(page: number): TreeNode[] {
    const nodes: TreeNode[] = [];
    for (let i = 0; i < 15; i++) {
      nodes.push({
        key: `root-${page}-${i}`,
        label: `Zewnętrzny węzeł z API (Strona ${page + 1}, Nr ${i + 1})`,
        leaf: false,
      });
    }
    return nodes;
  }

  private generateChildrenPage(parentKey: string, page: number): TreeNode[] {
    const nodes: TreeNode[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push({
        key: `${parentKey}-child-${page}-${i}`,
        label: `Dziecko (Strona ${page + 1}, Nr ${i + 1})`,
        leaf: false
      });
    }
    return nodes;
  }

  protected treeConfig = ErpTreeSelectBuilder.create((t) => 
    t.setPlaceholder('Wybierz kategorie z drzewa')
     .setOptions([
       ...this.generateRootPage(0),
       this.loadMoreNode(null)
     ])
     .setOnNodeExpand((node) => {
       // Pierwsze pobranie dzieci dla węzła
       if (!node.children || node.children.length === 0) {
         return new Promise<void>((resolve) => {
           setTimeout(() => {
             this.childrenPageMap.set(node.key!, 0);
             node.children = [
               ...this.generateChildrenPage(node.key!, 0),
               this.loadMoreNode(node)
             ];
             resolve();
           }, 800);
         });
       }
       return;
     })
     .setOnLoadMore((parentNode) => {
       // Doczytywanie kolejnych stron (Infinite Scroll po wejściu w viewport)
       return new Promise<void>((resolve) => {
         setTimeout(() => {
           if (parentNode === null) {
             // Doczytywanie korzeni (Root)
             this.rootPage++;
             const currentOptions = this.treeConfig.options.filter(n => !n.data?.isLoadMore);
             const newNodes = this.generateRootPage(this.rootPage);
             
             // Po 3 stronach nie dodajemy już 'load-more' by zamknąć listę
             if (this.rootPage < 3) {
               newNodes.push(this.loadMoreNode(null));
             }
             
             // Mutacja tablicy, aby PrimeNG wykryło zmiany (IterableDiffers)
             this.treeConfig.options.length = 0;
             this.treeConfig.options.push(...currentOptions, ...newNodes);
             
           } else {
             // Doczytywanie dzieci
             const currentPage = this.childrenPageMap.get(parentNode.key!) || 0;
             const nextPage = currentPage + 1;
             this.childrenPageMap.set(parentNode.key!, nextPage);
             
             const currentChildren = (parentNode.children || []).filter(n => !n.data?.isLoadMore);
             const newNodes = this.generateChildrenPage(parentNode.key!, nextPage);
             
             if (nextPage < 3) {
               newNodes.push(this.loadMoreNode(parentNode));
             }
             
             parentNode.children = [...currentChildren, ...newNodes];
           }
           resolve();
         }, 800);
       });
     })
  );

  protected readonly filtersConfig = ErpDynamicFilterBuilder.create((b) => {
    // ... tutaj inne filtry (zakomentowane)
    b.addFilter('Kategoria zaawansowana', ErpTreeSelectComponent, { config: this.treeConfig });
  });

  protected readonly testFormConfig = ErpFormBuilder.create(f => f
    .setGridCols(2)
    .addField('sku', 'text', ErpInputTextBuilder.create(b => b.setPlaceholder('Kod SKU').setHint('Unikalny identyfikator produktu')), { colSpan:2 })
    .addField('name', 'text', ErpInputTextBuilder.create(b => b.setPlaceholder('Nazwa produktu')), { colSpan: 1 })
    .addField('category', 'select', ErpSelectBuilder.create(b => b.setPlaceholder('Kategoria').setOptions([
      { label: 'Elektronika', value: 'ele' },
      { label: 'Dom i Ogród', value: 'home' }
    ])))
    .addField('price', 'text', ErpInputTextBuilder.create(b => b.setPlaceholder('Cena netto').setIcon('pi pi-money-bill')))
    .addField('availableFrom', 'datepicker', ErpDatePickerBuilder.create(b => b.setPlaceholder('Dostępny od')), { colSpan: 2 })
  );

  protected readonly cancelBtnConfig = ErpButtonBuilder.create(b => b.setLabel('Anuluj').setVariant('text').setSeverity('secondary'));
  protected readonly saveBtnConfig = ErpButtonBuilder.create(b => b.setLabel('Zapisz produkt').setSeverity('secondary').setOnClick(() => this.saveProduct()));

  protected readonly formCardConfig = ErpCardBuilder.create(b => b
    .setTitle('Informacje o produkcie')
    .setSubtitle('Wprowadź podstawowe dane techniczne i handlowe')
    .setContentComponent(ErpFormComponent, { config: this.testFormConfig })
    .setFooterComponent(ErpActionButtonsComponent, {
      config: {
        buttons: [
          { ...this.cancelBtnConfig, id: 'cancel' },
          { ...this.saveBtnConfig, id: 'save' }
        ]
      }
    })
  );

  protected readonly tabsConfig = ErpTabsBuilder.create(b => b
    .addItem('Lista produktów', '0', ErpTableComponent, { config: this.tableConfig, data: this.products() })
    .addItem('Multimedia', '1', ProductFlowComponent)
    .addItem('Magazyn', '2')
    .addItem('Historia zmian', '3')
    .addItem('Dodaj produkt (Test Form)', '4', ErpCardComponent, { config: this.formCardConfig })
    .setInitialValue('0')
    .onTabChange(val => this.activeTab.set(val))
  );

  protected saveProduct(): void {
    console.log('Product Data:', this.testFormConfig.formGroup.value);
  }

  protected onFilter(): void {
    console.log('Applied filters - submit triggered');
  }
}
