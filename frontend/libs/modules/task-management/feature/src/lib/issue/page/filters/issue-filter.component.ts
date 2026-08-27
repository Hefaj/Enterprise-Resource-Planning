import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ErpFilterBuilder, ErpFilterComponent, ErpFilterConfig } from '@erp/shared/ui';
import {
  ProjectVM,
  SearchIssueRequest,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_SCOPE, ISSUE_PRIORITY } from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

import { IssueStore } from '../issue.store';
import { ISSUE_KEYS } from '../../translation';

/** Pozycja listy wyboru w filtrze — etykieta jest już przetłumaczona, bo `erp-input-picker`
 * pokazuje wartość pola, nie klucz. */
interface FilterOption {
  readonly value: number | string;
  readonly label: string;
}

/**
 * Filtry listy zgłoszeń.
 *
 * <p><b>Dwa przełączniki nad tabelą</b> (`docs/frontend/task-management-pages.md` §2.1) są tutaj,
 * a nie w toolbarze: zakres i projekt to filtry, a nie akcje — trafiają do `SearchIssueRequest`
 * dokładnie tak samo jak tekst czy priorytet.</p>
 *
 * <p><b>Filtr stanu pojawia się dopiero po wybraniu projektu</b> i nigdy nie ma stałej listy
 * opcji: stany pochodzą ze schematu projektu (`getProjectWorkflow`), a nie z enumu w kodzie.
 * Bez kontekstu projektu nie ma jednego zbioru stanów, po którym dałoby się filtrować.</p>
 */
@Component({
  selector: 'erp-task-management-issue-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueFilterComponent implements OnInit {
  private readonly _store = inject(IssueStore);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _transloco = inject(TranslocoService);

  private readonly _projectUuids = signal<string[]>([]);

  private readonly _projectOptions = computed<FilterOption[]>(() => {
    const viewModels = this._projects.getViewModel()();

    return this._projectUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((vm): vm is ProjectVM => vm !== undefined)
      .map((project) => ({ value: project.uuid, label: `${project.code} — ${project.name}` }));
  });

  private readonly _scopeOptions = computed<FilterOption[]>(() => [
    { value: ISSUE_SCOPE.Available, label: this._transloco.translate(ISSUE_KEYS.filters.scope.available) },
    { value: ISSUE_SCOPE.AssignedToMe, label: this._transloco.translate(ISSUE_KEYS.filters.scope.assignedToMe) },
    { value: ISSUE_SCOPE.ReportedByMe, label: this._transloco.translate(ISSUE_KEYS.filters.scope.reportedByMe) },
  ]);

  private readonly _priorityOptions = computed<FilterOption[]>(() => [
    { value: ISSUE_PRIORITY.Critical, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.critical) },
    { value: ISSUE_PRIORITY.High, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.high) },
    { value: ISSUE_PRIORITY.Normal, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.normal) },
    { value: ISSUE_PRIORITY.Low, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.low) },
    { value: ISSUE_PRIORITY.Lowest, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.lowest) },
  ]);

  /** Stany aktywnego projektu. `nameKey` ze schematu jest kluczem tłumaczenia; stan zdefiniowany
   * przez użytkownika bez klucza wyświetla własny kod — jedyne dopuszczone wyjście poza registry
   * (`docs/frontend/task-management-pages.md` §8). */
  private readonly _stateOptions = computed<FilterOption[]>(() =>
    this._store.states().map((state) => ({
      value: state.uuid,
      label: state.nameKey ? this._transloco.translate(state.nameKey) : state.code,
    })),
  );

  private readonly _initialValues = computed(() => this._store.filters());

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create((b) =>
    b
      .setFilterKey('taskmgmt-issue-list')
      .setInitialValues(this._initialValues)
      .setOnSearch((val) => this.onSearch(val))
      .setLoading(this._store.loading)
      .addFormField('text', 'text', (f) =>
        f.setLabel(ISSUE_KEYS.filters.text.label).setPlaceholder(ISSUE_KEYS.filters.text.placeholder),
      )
      .addFormField('scope', 'inputPicker', (f) =>
        f
          .setLabel(ISSUE_KEYS.filters.scope.label)
          .setItems(this._scopeOptions)
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      )
      .addFormField('projectUuid', 'inputPicker', (f) =>
        f
          .setLabel(ISSUE_KEYS.filters.project.label)
          .setSearchPlaceholder(ISSUE_KEYS.filters.project.placeholder)
          .setItems(this._projectOptions)
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      )
      .addFormField('stateUuid', 'inputPicker', (f) =>
        f
          .setLabel(ISSUE_KEYS.filters.state.label)
          .setSearchPlaceholder(ISSUE_KEYS.filters.state.placeholder)
          .setItems(this._stateOptions)
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      )
      .addFormField('priority', 'inputPicker', (f) =>
        f
          .setLabel(ISSUE_KEYS.filters.priority.label)
          .setSearchPlaceholder(ISSUE_KEYS.filters.priority.placeholder)
          .setItems(this._priorityOptions)
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      ),
  );

  public ngOnInit(): void {
    void this._loadProjects();
  }

  public onSearch(filters: Partial<SearchIssueRequest>): void {
    this._store.updateFilters(filters);
  }

  /** Projektów są dziesiątki, nie tysiące — jedno pobranie na wejście na stronę wystarcza,
   * bez wyszukiwania serwerowego w pickerze. */
  private async _loadProjects(): Promise<void> {
    try {
      const response = await this._projects.searchAsync({ page: 1, pageSize: 200 }, { autoLoad: true });
      this._projectUuids.set(response.uuids ?? []);
    } catch (error) {
      console.error('[IssueFilterComponent] Nie udało się pobrać listy projektów.', error);
    }
  }
}
