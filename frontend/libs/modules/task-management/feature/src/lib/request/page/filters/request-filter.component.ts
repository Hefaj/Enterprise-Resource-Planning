import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ErpFilterBuilder, ErpFilterComponent, ErpFilterConfig } from '@erp/shared/ui';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';
import { ISSUE_SCOPE, PROJECT_KIND } from '@erp/task-management/util';

import { IssueStore } from '../../../issue/page/issue.store';
import { REQUEST_KEYS } from '../../translation';

interface FilterOption {
  readonly value: number | string;
  readonly label: string;
}

/**
 * Filtry strony „Zlecenia" — wersja `IssueFilterComponent` zawężona do rejestrów zleceń
 * (`ProjectKind.Intake`). Bez filtrów po polach własnych i bez trybu drzewa: rejestr zleceń
 * nie ma dziś ani jednego, ani drugiego, a strona nie ma po co proponować pustych opcji.
 *
 * <p>Pierwszy dostępny rejestr wybiera się automatycznie — w typowym wdrożeniu jest dokładnie
 * jeden (`docs/backend/task-management-requirements.md` REQ-002), więc użytkownik nie powinien
 * musieć klikać pickera, żeby zobaczyć swoje zlecenia.</p>
 */
@Component({
  selector: 'erp-task-management-request-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFilterComponent implements OnInit {
  private readonly _store = inject(IssueStore);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _transloco = inject(TranslocoService);

  private readonly _intakeProjectUuids = signal<string[]>([]);

  private readonly _projectOptions = computed<FilterOption[]>(() => {
    const viewModels = this._projects.getViewModel()();

    return this._intakeProjectUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((vm): vm is ProjectVM => vm !== undefined)
      .map((project) => ({ value: project.uuid, label: `${project.code} — ${project.name}` }));
  });

  private readonly _scopeOptions = computed<FilterOption[]>(() => [
    { value: ISSUE_SCOPE.Available, label: this._transloco.translate(REQUEST_KEYS.filters.scope.available) },
    { value: ISSUE_SCOPE.ReportedByMe, label: this._transloco.translate(REQUEST_KEYS.filters.scope.reportedByMe) },
  ]);

  private readonly _initialValues = computed(() => this._store.filters());

  protected readonly filterConfig = computed<ErpFilterConfig>(() =>
    ErpFilterBuilder.create((b) =>
      b
        .setFilterKey('taskmgmt-request-list')
        .setInitialValues(this._initialValues)
        .setOnSearch((val) => this._store.updateFilters(val as Record<string, unknown>))
        .setLoading(this._store.loading)
        .addFormField('text', 'text', (f) =>
          f.setLabel(REQUEST_KEYS.filters.text.label).setPlaceholder(REQUEST_KEYS.filters.text.placeholder),
        )
        .addFormField('projectUuid', 'inputPicker', (f) =>
          f
            .setLabel(REQUEST_KEYS.filters.project.label)
            .setSearchPlaceholder(REQUEST_KEYS.filters.project.placeholder)
            .setItems(this._projectOptions)
            .setLabelKey('label')
            .setValueKey('value')
            .setStrategy('single'),
        )
        .addFormField('scope', 'inputPicker', (f) =>
          f
            .setLabel(REQUEST_KEYS.filters.scope.label)
            .setItems(this._scopeOptions)
            .setLabelKey('label')
            .setValueKey('value')
            .setStrategy('single'),
        ),
    ),
  );

  public constructor() {
    // Pierwszy rejestr zleceń wybiera się automatycznie, gdy dojedzie z serwera i strona nie ma
    // jeszcze żadnego kontekstu projektu — bez tego lista startowałaby pusta mimo istniejących
    // zleceń, dopóki użytkownik sam nie otworzy pickera.
    effect(() => {
      const uuids = this._intakeProjectUuids();
      const current = this._store.filters().projectUuid;

      if (uuids.length > 0 && !current) {
        untracked(() => this._store.updateFilters({ projectUuid: uuids[0] }));
      }
    });
  }

  public ngOnInit(): void {
    void this._loadIntakeProjectsAsync();
  }

  private async _loadIntakeProjectsAsync(): Promise<void> {
    try {
      const response = await this._projects.searchAsync(
        { page: 1, pageSize: 200, kind: PROJECT_KIND.Intake },
        { autoLoad: true },
      );
      this._intakeProjectUuids.set(response.uuids ?? []);
    } catch (error) {
      console.error('[RequestFilterComponent] Nie udało się pobrać rejestrów zleceń.', error);
    }
  }
}
