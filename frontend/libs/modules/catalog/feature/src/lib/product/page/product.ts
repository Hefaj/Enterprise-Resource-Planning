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
  ErpTabsBuilder
} from '@erp/shared/ui';

import { ProductFlowComponent } from './product-flow/product-flow.component';
import { TreeNode } from 'primeng/api';

@Component({
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent, ErpDynamicFilterComponent, ErpTabsComponent],
  template: `
    <erp-page-layout>
      <!-- Lewy panel: Filtry -->
      <div filters>
        <erp-dynamic-filter [config]="filtersConfig" (filterSubmit)="onFilter()" />
      </div>

      <!-- Nagłówek: Zakładki (Headless) -->
      <!-- <div header class="w-full">
        <erp-tabs [config]="tabsConfig" [(value)]="activeTab" [headless]="true" />
      </div> -->

      <!-- Kontent -->
      <div class="h-full">
        <erp-tabs [config]="tabsConfig" [(value)]="activeTab">
          <!-- Placeholdery dla zakładek bez komponentów (opcjonalne) -->
          @if (activeTab() === '0') {
            <div class="h-full flex items-center justify-center border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-2xl bg-surface-50/50 dark:bg-surface-800/20 text-surface-400 dark:text-surface-500">
              Tabela z produktami (Zakładka 0)
            </div>
          } @else if (activeTab() === '2') {
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

  protected readonly tabsConfig = ErpTabsBuilder.create(b => b
    .addItem('Lista produktów', '0') // Możemy tu później dodać ErpTableComponent
    .addItem('Multimedia', '1', ProductFlowComponent)
    .addItem('Magazyn', '2')
    .addItem('Historia zmian', '3')
    .addItem('Dodaj produkt (Test Form)', '4', ErpCardComponent, { config: this.formCardConfig })
    .setInitialValue('0')
    .onTabChange(val => this.activeTab.set(val))
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

  protected saveProduct(): void {
    console.log('Product Data:', this.testFormConfig.formGroup.value);
  }

  protected onFilter(): void {
    console.log('Applied filters - submit triggered');
  }
}
