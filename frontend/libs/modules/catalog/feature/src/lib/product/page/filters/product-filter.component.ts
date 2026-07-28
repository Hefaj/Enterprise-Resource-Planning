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
    <erp-filter 
      [config]="filterConfig" 
      [savedPresets]="savedPresets()"
      (search)="onSearch($event)"
      (savePresetEvent)="onSavePreset($event)"
      (loadPresetEvent)="onLoadPreset($event)"
      (deletePresetEvent)="onDeletePreset($event)">
    </erp-filter>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent implements OnInit {
  private readonly store = inject(ProductListViewStore);
  private readonly preferencesService = inject(ErpUserPreferencesService);

  public readonly savedPresets = signal<Record<string, any>>({});

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create(b => b
    .setFilterKey('product-list')
    .addGroup('base', g => g
      .setTitle('Podstawowe filtry')
      .addFormField('searchQuery', 'text', f => f.setLabel('Szukaj').setPlaceholder('Nazwa produktu, SKU...').setIconStart('@tui.search'))
      .addFormField('category', 'inputPicker', f => f
        .setLabel('Kategoria')
        .setStrategy('multi')
        .setItems(['Elektronika', 'AGD', 'Ogród', 'Motoryzacja', 'Odzież', 'Zabawki'])
      )
      .addFormField('status', 'inputPicker', f => f
        .setLabel('Status')
        .setStrategy('single')
        .setItems(['Dostępny', 'Niedostępny', 'W drodze', 'Wycofany'])
      )
    )
    .addGroup('pricing', g => g
      .setTitle('Ceny i promocje')
      .addFormField('minPrice', 'number', f => f.setLabel('Cena od').setMode('decimal').setDecimals(2).setSign('positive'))
      .addFormField('maxPrice', 'number', f => f.setLabel('Cena do').setMode('decimal').setDecimals(2).setSign('positive'))
      .addFormField('onlyDiscounted', 'switch', f => f.setLabel('Tylko przecenione'))
    )
    .addGroup('inventory', g => g
      .setTitle('Stan magazynowy')
      .setExpanded(false)
      .addFormField('minQuantity', 'number', f => f.setLabel('Minimalna ilość na stanie').setMode('integer').setSign('positive').setStepper(true).setStep(1))
      .addFormField('inStock', 'switch', f => f.setLabel('Dostępne w magazynie').setValue(true))
    )
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
