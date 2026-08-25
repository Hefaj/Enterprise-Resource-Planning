import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ErpFilterBuilder, ErpFilterComponent, ErpFilterConfig } from '@erp/shared/ui';
import { ErpUserPreferencesService } from '@erp/shared/data-access';
import { SearchMultimediaRequest } from '@erp/catalog/data-access';

import { MULTIMEDIA_KEYS } from '../../translation';
import { MultimediaStore } from '../multimedia.store';

/**
 * Filtr biblioteki mediów.
 *
 * Cztery pola, z czego dwa przełączniki niosą cały sens tej strony: „tylko nieużywane" pokazuje
 * pliki, które w ogóle da się usunąć, a „tylko bez miniatur" — te, dla których warto zlecić
 * generowanie. Oba są też filtrem CELU operacji masowej, więc „zaznacz wszystko" nad nimi
 * znaczy dokładnie „wszystkie osierocone", a nie „ta strona wyników".
 */
@Component({
  selector: 'erp-multimedia-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig"></erp-filter>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaFilterComponent implements OnInit {
  private readonly store = inject(MultimediaStore);
  private readonly preferencesService = inject(ErpUserPreferencesService);

  public readonly savedPresets = signal<Record<string, unknown>>({});

  private readonly initialValues = computed(() => ({ ...this.store.filters() }));

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create(b => b
    .setFilterKey('multimedia-library')
    .setInitialValues(this.initialValues)
    .setOnSearch(val => this.onSearch(val))
    .setLoading(this.store.loading)
    .setSavedPresets(this.savedPresets)
    .setOnSavePreset(val => this.onSavePreset(val))
    .setOnLoadPreset(val => this.onLoadPreset(val))
    .setOnDeletePreset(val => this.onDeletePreset(val))
    .addFormField('fileName', 'text', f => f.setLabel(MULTIMEDIA_KEYS.base.filters.fileName))
    .addFormField('mediaType', 'text', f => f.setLabel(MULTIMEDIA_KEYS.base.filters.mediaType))
    .addFormField('onlyUnreferenced', 'switch', f => f.setLabel(MULTIMEDIA_KEYS.base.filters.onlyUnreferenced))
    .addFormField('onlyWithoutDerivatives', 'switch', f => f.setLabel(MULTIMEDIA_KEYS.base.filters.onlyWithoutDerivatives))
  );

  private get presetKey(): string {
    return `erp-filter-${this.filterConfig.filterKey}`;
  }

  public ngOnInit(): void {
    this.checkSavedPreset();
  }

  public onSearch(filters: Partial<SearchMultimediaRequest>): void {
    this.store.updateFilters(filters);
  }

  public onSavePreset(event: { name: string; value: Partial<SearchMultimediaRequest> }): void {
    this.preferencesService.saveFilterPreset(this.presetKey, event.name, event.value);
    this.checkSavedPreset();
  }

  public onLoadPreset(presetName: string): void {
    const preset = this.preferencesService.getFilterPresets(this.presetKey)[presetName];

    if (preset) {
      this.filterConfig.formGroup.patchValue(preset);
    }
  }

  public onDeletePreset(presetName: string): void {
    this.preferencesService.deleteFilterPreset(this.presetKey, presetName);
    this.checkSavedPreset();
  }

  private checkSavedPreset(): void {
    this.savedPresets.set(this.preferencesService.getFilterPresets(this.presetKey) || {});
  }
}
