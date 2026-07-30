import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpFilterComponent, ErpFilterBuilder, ErpFilterConfig } from '@erp/shared/ui';
import { ErpUserPreferencesService } from '@erp/shared/data-access';
import { ProductListViewStore } from '../product-list-view.store';
import { SearchProductRequest } from '@erp/catalog/data-access';

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
  private readonly store = inject(ProductListViewStore);
  private readonly preferencesService = inject(ErpUserPreferencesService);

  public readonly savedPresets = signal<Record<string, any>>({});

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create(b => b
    .setFilterKey('product-list')
    .setOnSearch(val => this.onSearch(val))
    .setLoading(this.store.loading)
    .setSavedPresets(this.savedPresets)
    .setOnSavePreset(val => this.onSavePreset(val))
    .setOnLoadPreset(val => this.onLoadPreset(val))
    .setOnDeletePreset(val => this.onDeletePreset(val))
    .addFormField('productId', 'inputPicker', f => f.setLabel('ID produktu'))
    .addFormField('modelId', 'text', f => f.setLabel('ID modelu'))
    .addFormField('productType', 'text', f => f.setLabel('Rodzaj produktu'))
    .addFormField('manufacturer', 'text', f => f.setLabel('Producent'))
    .addFormField('model', 'text', f => f.setLabel('Model'))
    .addFormField('category', 'text', f => f.setLabel('Kategoria'))
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

  public onSearch(filters: Partial<SearchProductRequest>): void {
    this.store.updateFilters(filters);
  }

  public onSavePreset(event: { name: string, value: Partial<SearchProductRequest> }): void {
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
