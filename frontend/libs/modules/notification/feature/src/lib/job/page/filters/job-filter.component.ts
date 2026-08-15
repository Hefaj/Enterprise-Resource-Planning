import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ErpFilterBuilder, ErpFilterComponent, ErpFilterConfig } from '@erp/shared/ui';
import { ErpUserPreferencesService } from '@erp/shared/data-access';
import { SearchJobRequest } from '@erp/notification/data-access';
import { JOB_KEYS } from '@erp/notification/ui';
import { JobStore } from '../job.store';

/**
 * Panel filtrów historii zadań.
 *
 * Pola odpowiadają jeden do jednego temu, co potrafi odsiać `JobQueries.SearchAsync` —
 * dokładanie tu pola, którego backend nie zna, dałoby filtr wyglądający na działający
 * i po cichu ignorowany. Status („wszystkie / w toku / zakończone") jest świadomie POZA
 * tym panelem: mieszka na zakładkach strony, bo to przełącznik widoku, nie kryterium.
 */
@Component({
  selector: 'erp-job-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobFilterComponent implements OnInit {
  private readonly _store = inject(JobStore);
  private readonly _preferencesService = inject(ErpUserPreferencesService);

  protected readonly savedPresets = signal<Record<string, unknown>>({});

  private readonly _initialValues = computed(() => this._store.filters());

  protected readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create(b => b
    .setFilterKey('job-history')
    .setInitialValues(this._initialValues)
    .setLoading(this._store.loading)
    .setOnSearch(values => this.onSearch(values))
    .setSavedPresets(this.savedPresets)
    .setOnSavePreset(event => this.onSavePreset(event))
    .setOnLoadPreset(name => this.onLoadPreset(name))
    .setOnDeletePreset(name => this.onDeletePreset(name))
    .addFormField('trackingId', 'text', f => f.setLabel(JOB_KEYS.page.filters.trackingId))
    .addFormField('queueId', 'text', f => f.setLabel(JOB_KEYS.page.filters.queueId))
    .addFormField('clientId', 'text', f => f.setLabel(JOB_KEYS.page.filters.clientId))
  );

  private get _presetKey(): string {
    return `erp-filter-${this.filterConfig.filterKey}`;
  }

  public ngOnInit(): void {
    this._checkSavedPresets();
  }

  /**
   * Scalanie, nie podmiana: `isComplete` ustawiają zakładki strony i nie może zniknąć
   * przy wyszukiwaniu z tego panelu.
   */
  protected onSearch(values: Partial<SearchJobRequest>): void {
    this._store.updateFilters(values);
  }

  protected onSavePreset(event: { name: string; value: Partial<SearchJobRequest> }): void {
    this._preferencesService.saveFilterPreset(this._presetKey, event.name, event.value);
    this._checkSavedPresets();
  }

  protected onLoadPreset(presetName: string): void {
    const preset = this._preferencesService.getFilterPresets(this._presetKey)[presetName];
    if (preset) {
      this.filterConfig.formGroup.patchValue(preset);
    }
  }

  protected onDeletePreset(presetName: string): void {
    this._preferencesService.deleteFilterPreset(this._presetKey, presetName);
    this._checkSavedPresets();
  }

  private _checkSavedPresets(): void {
    this.savedPresets.set(this._preferencesService.getFilterPresets(this._presetKey) || {});
  }
}
