import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

import { ErpFilterBuilder, ErpFilterComponent, ErpFilterConfig } from '@erp/shared/ui';
import { SearchProjectRequest } from '@erp/task-management/data-access';
import { PROJECT_KIND } from '@erp/task-management/util';

import { ProjectStore } from '../project.store';
import { PROJECT_KEYS } from '../../translation';

/** Filtry listy projektów. */
@Component({
  selector: 'erp-task-management-project-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFilterComponent {
  private readonly _store = inject(ProjectStore);
  private readonly _transloco = inject(TranslocoService);

  /** Ta sama pułapka co na liście zgłoszeń: `translate()` w `computed` bez reaktywnej zależności
   * zapamiętuje surowy klucz, jeśli scope nie zdążył dojechać. Sygnał ze zdarzeń Transloco jest
   * tą zależnością. */
  private readonly _translationsReady = toSignal(this._transloco.events$, { initialValue: null });

  private readonly _kindOptions = computed(() => {
    this._translationsReady();

    return [
      { value: PROJECT_KIND.Delivery, label: this._transloco.translate(PROJECT_KEYS.filters.kind.delivery) },
      { value: PROJECT_KIND.Intake, label: this._transloco.translate(PROJECT_KEYS.filters.kind.intake) },
    ];
  });

  private readonly _initialValues = computed(() => this._store.filters());

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create((b) =>
    b
      .setFilterKey('taskmgmt-project-list')
      .setInitialValues(this._initialValues)
      .setOnSearch((val) => this.onSearch(val))
      .setLoading(this._store.loading)
      .addFormField('text', 'text', (f) =>
        f.setLabel(PROJECT_KEYS.filters.text.label).setPlaceholder(PROJECT_KEYS.filters.text.placeholder),
      )
      .addFormField('kind', 'inputPicker', (f) =>
        f
          .setLabel(PROJECT_KEYS.filters.kind.label)
          .setSearchPlaceholder(PROJECT_KEYS.filters.kind.placeholder)
          .setItems(this._kindOptions)
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      )
      .addFormField('onlyMine', 'checkbox', (f) => f.setLabel(PROJECT_KEYS.filters.onlyMine.label)),
  );

  public onSearch(filters: Partial<SearchProjectRequest>): void {
    this._store.updateFilters(filters);
  }
}
