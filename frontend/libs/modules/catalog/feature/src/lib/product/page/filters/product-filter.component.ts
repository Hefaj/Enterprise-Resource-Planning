import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpFilterComponent, ErpFilterBuilder, ErpFilterConfig, ErpTreeSelectionValue } from '@erp/shared/ui';
import { ErpUserPreferencesService } from '@erp/shared/data-access';
import { ProductStore } from '../product.store';
import { SearchProductRequest } from '@erp/catalog/data-access';
import {
  CatalogCategoryTreePickerComponent,
  CatalogCategoryTreePickerConfig,
  categorySelectionToUuids,
  categoryUuidsToSelection,
} from '../../../category/components/catalog-category-tree-picker/catalog-category-tree-picker.component';

/** Kształt wartości formularza filtrów — `category` trzyma natywny deskryptor zaznaczenia drzewa, nie sam uuid. */
type ProductFilterFormValue = Omit<Partial<SearchProductRequest>, 'category'> & {
  category?: ErpTreeSelectionValue | null;
};

@Component({
  selector: 'erp-product-filter',
  standalone: true,
  imports: [CommonModule, ErpFilterComponent],
  template: `
    <erp-filter [config]="filterConfig"></erp-filter>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent implements OnInit {
  private readonly store = inject(ProductStore);
  private readonly preferencesService = inject(ErpUserPreferencesService);

  public readonly savedPresets = signal<Record<string, any>>({});

  private readonly categoryFieldConfig: CatalogCategoryTreePickerConfig = {
    label: 'Kategorie',
  };

  private readonly initialValues = computed(() => ({
    ...this.store.filters(),
    category: categoryUuidsToSelection(this.store.filters().category),
  }));

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create(b => b
    .setFilterKey('product-list')
    .setInitialValues(this.initialValues)
    .setOnSearch(val => this.onSearch(val))
    .setLoading(this.store.loading)
    .setSavedPresets(this.savedPresets)
    .setOnSavePreset(val => this.onSavePreset(val))
    .setOnLoadPreset(val => this.onLoadPreset(val))
    .setOnDeletePreset(val => this.onDeletePreset(val))
    .addFormField('productId', 'text', f => f.setLabel('ID produktu'))
    .addFormField('productIds', 'bulkInput', f => f.setLabel('ID produktów (masowo)'))
    .addFormField('modelId', 'text', f => f.setLabel('ID modelu'))
    .addFormField('productType', 'text', f => f.setLabel('Rodzaj produktu'))
    .addFormField('manufacturer', 'text', f => f.setLabel('Producent'))
    .addFormField('model', 'text', f => f.setLabel('Model'))
    .addCustomFormField('category', CatalogCategoryTreePickerComponent, this.categoryFieldConfig)
    .addFormField('attribute', 'text', f => f.setLabel('Atrybut'))
    .addFormField('productCode', 'text', f => f.setLabel('Kod produktu').setTooltip('test'))
    .addFormField('territoryCode', 'text', f => f.setLabel('Kod terytorium'))
    .addFormField('summaryReport', 'switch', f => f.setLabel('Raport sumujący'))
  );

  private get presetKey(): string {
    return `erp-filter-${this.filterConfig.filterKey}`;
  }

  public ngOnInit(): void {
    this.checkSavedPreset();
    // Uncomment to auto-load filters on init
    // this.onLoadPreset();
  }

  public onSearch(filters: ProductFilterFormValue): void {
    const { category, ...rest } = filters;
    this.store.updateFilters({ ...rest, category: categorySelectionToUuids(category) });
  }

  public onSavePreset(event: { name: string, value: ProductFilterFormValue }): void {
    this.preferencesService.saveFilterPreset(this.presetKey, event.name, event.value);
    this.checkSavedPreset();
  }

  public onLoadPreset(presetName: string): void {
    const presets = this.preferencesService.getFilterPresets(this.presetKey);
    const preset = presets[presetName];
    if (preset) {
      this.filterConfig.formGroup.patchValue(preset);
    }
  }

  public onDeletePreset(presetName: string): void {
    this.preferencesService.deleteFilterPreset(this.presetKey, presetName);
    this.checkSavedPreset();
  }

  private checkSavedPreset(): void {
    const presets = this.preferencesService.getFilterPresets(this.presetKey);
    this.savedPresets.set(presets || {});
  }
}
