import { signal } from '@angular/core';
import { ProductTableComponent } from '@erp/catalog/ui';
import { ErpCardBuilder, ErpCardComponent } from '@erp/shared/ui/erp-card';
import { ErpDatePickerBuilder } from '@erp/shared/ui/erp-datepicker';
import { ErpDynamicFilterBuilder } from '@erp/shared/ui/erp-dynamic-filter';
import { ErpFormBuilder, ErpFormComponent } from '@erp/shared/ui/erp-form';
import { ErpInputTextBuilder } from '@erp/shared/ui/erp-input-text';
import { ErpSelectBuilder } from '@erp/shared/ui/erp-select';
import { ErpTabsBuilder } from '@erp/shared/ui/erp-tabs';
import { ErpTreeSelectComponent, ErpTreeSelectBuilder } from '@erp/shared/ui/erp-tree-select';
import { TreeNode } from 'primeng/api';
import { noop } from 'rxjs';
import { ProductFlowComponent } from './product-flow/product-flow.component';
import { ErpActionButtonsComponent, ErpActionButtonsBuilder } from '@erp/shared/ui/erp-action-buttons';
import { ErpButtonBuilder } from '@erp/shared/ui/erp-button';

export const onFilter = (): void => {
  console.log('Applied filters - submit triggered');
};

export const testFormConfig = ErpFormBuilder.create((f) =>
  f
    .setGridCols(2)
    .addField(
      'sku',
      'text',
      ErpInputTextBuilder.create((b) => b.setPlaceholder('Kod SKU').setHint('Unikalny identyfikator produktu')),
      { colSpan: 2 },
    )
    .addField(
      'name',
      'text',
      ErpInputTextBuilder.create((b) => b.setPlaceholder('Nazwa produktu')),
      { colSpan: 1 },
    )
    .addField(
      'category',
      'select',
      ErpSelectBuilder.create((b) =>
        b.setPlaceholder('Kategoria').setOptions([
          { label: 'Elektronika', value: 'ele' },
          { label: 'Dom i Ogród', value: 'home' },
        ]),
      ),
    )
    .addField(
      'price',
      'text',
      ErpInputTextBuilder.create((b) => b.setPlaceholder('Cena netto').setIcon('pi pi-money-bill')),
    )
    .addField(
      'availableFrom',
      'datepicker',
      ErpDatePickerBuilder.create((b) => b.setPlaceholder('Dostępny od')),
      { colSpan: 2 },
    ),
);

export const saveProduct = (): void => {
  console.log('Product Data:', testFormConfig.formGroup.value);
};

export const cancelBtnConfig = ErpButtonBuilder.create((b) => b.setLabel('Anuluj').setVariant('text').setSeverity('secondary'));
export const saveBtnConfig = ErpButtonBuilder.create((b) =>
  b
    .setLabel('Zapisz produkt')
    .setSeverity('secondary')
    .setOnClick(() => saveProduct()),
);

export const formCardConfig = ErpCardBuilder.create((b) =>
  b
    .setTitle('Informacje o produkcie')
    .setSubtitle('Wprowadź podstawowe dane techniczne i handlowe')
    .setContentComponent(ErpFormComponent, { config: testFormConfig })
    .setFooterComponent(ErpActionButtonsComponent, {
      config: ErpActionButtonsBuilder.create((b) => {
        b.addButton({ ...cancelBtnConfig, id: 'cancel' });
        b.addButton({ ...saveBtnConfig, id: 'save' });
      }),
    }),
);

export const loadMoreNode = (parentNode: TreeNode | null): TreeNode => {
  return {
    key: parentNode ? `${parentNode.key}-load-more` : 'root-load-more',
    data: { isLoadMore: true, parentNode: parentNode },
    selectable: false,
  };
};

export const generateRootPage = (page: number): TreeNode[] => {
  const nodes: TreeNode[] = [];
  for (let i = 0; i < 15; i++) {
    nodes.push({
      key: `root-${page}-${i}`,
      label: `Zewnętrzny węzeł z API (Strona ${page + 1}, Nr ${i + 1})`,
      leaf: false,
    });
  }
  return nodes;
};

export const generateChildrenPage = (parentKey: string, page: number): TreeNode[] => {
  const nodes: TreeNode[] = [];
  for (let i = 0; i < 10; i++) {
    nodes.push({
      key: `${parentKey}-child-${page}-${i}`,
      label: `Dziecko (Strona ${page + 1}, Nr ${i + 1})`,
      leaf: false,
    });
  }
  return nodes;
};

export const treeOptions = signal<TreeNode[]>([...generateRootPage(0), loadMoreNode(null)]);

export let rootPage = 0;
export const childrenPageMap = new Map<string, number>();

export const treeConfig = ErpTreeSelectBuilder.create((t) =>
  t
    .setPlaceholder('Wybierz kategorie z drzewa')
    .setOptions(treeOptions)
    .setOnNodeExpand((node) => {
      // Pierwsze pobranie dzieci dla węzła
      if (!node.children || node.children.length === 0) {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            childrenPageMap.set(node.key!, 0);
            node.children = [...generateChildrenPage(node.key!, 0), loadMoreNode(node)];
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
            rootPage++;
            const currentOptions = treeOptions().filter((n: TreeNode) => !n.data?.isLoadMore);
            const newNodes = generateRootPage(rootPage);

            // Po 3 stronach nie dodajemy już 'load-more' by zamknąć listę
            if (rootPage < 3) {
              newNodes.push(loadMoreNode(null));
            }

            // Aktualizacja sygnału zamiast mutacji tablicy
            treeOptions.set([...currentOptions, ...newNodes]);
          } else {
            // Doczytywanie dzieci
            const currentPage = childrenPageMap.get(parentNode.key!) || 0;
            const nextPage = currentPage + 1;
            childrenPageMap.set(parentNode.key!, nextPage);

            const currentChildren = (parentNode.children || []).filter((n) => !n.data?.isLoadMore);
            const newNodes = generateChildrenPage(parentNode.key!, nextPage);

            if (nextPage < 3) {
              newNodes.push(loadMoreNode(parentNode));
            }

            parentNode.children = [...currentChildren, ...newNodes];
          }
          resolve();
        }, 800);
      });
    }),
);

// ── Dane testowe produktów ──
export const products = signal([
  { sku: 'ELE-001', name: 'Laptop ProMax 16"', category: 'Elektronika', price: 5499.99, availableFrom: new Date('2024-03-15'), status: 'Aktywny', available: true, image: null },
  { sku: 'ELE-002', name: 'Monitor UltraWide 34"', category: 'Elektronika', price: 2899.0, availableFrom: new Date('2024-01-20'), status: 'Aktywny', available: true, image: null },
  { sku: 'DOM-001', name: 'Fotel Ergonomiczny ErgoPlus', category: 'Dom i Ogród', price: 1299.0, availableFrom: new Date('2024-06-01'), status: 'Wycofany', available: false, image: null },
  { sku: 'ELE-003', name: 'Klawiatura Mechaniczna RGB', category: 'Elektronika', price: 449.99, availableFrom: new Date('2024-02-10'), status: 'Aktywny', available: true, image: null },
  { sku: 'DOM-002', name: 'Biurko Standing Desk 180cm', category: 'Dom i Ogród', price: 2199.0, availableFrom: new Date('2024-04-22'), status: 'Aktywny', available: true, image: null },
  { sku: 'ELE-004', name: 'Słuchawki Noise-Cancel Pro', category: 'Elektronika', price: 899.0, availableFrom: new Date('2024-05-05'), status: 'Draft', available: false, image: null },
  { sku: 'DOM-003', name: 'Lampa LED Biurkowa Smart', category: 'Dom i Ogród', price: 199.99, availableFrom: new Date('2024-07-12'), status: 'Aktywny', available: true, image: null },
  { sku: 'ELE-005', name: 'Mysz Bezprzewodowa Ergo', category: 'Elektronika', price: 249.0, availableFrom: new Date('2024-08-01'), status: 'Aktywny', available: true, image: null },
  { sku: 'DOM-004', name: 'Organizator Kabli Premium', category: 'Dom i Ogród', price: 79.99, availableFrom: new Date('2024-03-28'), status: 'Wycofany', available: false, image: null },
  { sku: 'ELE-006', name: 'Webcam 4K HDR', category: 'Elektronika', price: 599.0, availableFrom: new Date('2024-09-15'), status: 'Draft', available: false, image: null },
  { sku: 'DOM-005', name: 'Mata Antyzmęczeniowa 100x60', category: 'Dom i Ogród', price: 149.0, availableFrom: new Date('2024-01-05'), status: 'Aktywny', available: true, image: null },
  { sku: 'ELE-007', name: 'Hub USB-C 12w1 Pro', category: 'Elektronika', price: 349.0, availableFrom: new Date('2024-10-01'), status: 'Aktywny', available: true, image: null },
]);

export const filtersConfig = ErpDynamicFilterBuilder.create((b) => {
  b.addFilter('Kategoria zaawansowana', ErpTreeSelectComponent, { config: treeConfig });
  b.setOnSubmit(() => onFilter());
});

export const tabsConfig = ErpTabsBuilder.create((b) =>
  b
    .addTab('Lista produktów', '0', { component: ProductTableComponent, config: { data: products() } })
    .addTab('Multimedia', '1', { component: ProductFlowComponent })
    .addTab('Magazyn', '2', { component: ErpCardComponent, config: { config: formCardConfig } })
    .addTab('Historia zmian', '3', { component: ErpCardComponent, config: { config: formCardConfig } })
    .addTab('Dodaj produkt (Test Form)', '4', { component: ErpCardComponent, config: { config: formCardConfig } })
    .setInitialValue('0')
    .setOnTabChange(noop),
);
