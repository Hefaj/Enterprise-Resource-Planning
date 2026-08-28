import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ErpFilterBuilder, ErpFilterComponent, ErpFilterConfig, erpUserPickerField } from '@erp/shared/ui';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';
import {
  ProjectFieldDto,
  ProjectVM,
  SearchIssueRequest,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { CUSTOM_FIELD_DATA_TYPE, ISSUE_SCOPE, ISSUE_PRIORITY } from '@erp/task-management/util';
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
  template: `<erp-filter [config]="filterConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueFilterComponent implements OnInit {
  private readonly _store = inject(IssueStore);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _transloco = inject(TranslocoService);
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });

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

  /**
   * Konfiguracja filtra jest <b>przeliczana</b>, bo pola projekto-specyficzne dochodzą i znikają
   * razem z kontekstem projektu. Przebudowa tworzy nową grupę formularza — i tak jest to
   * pożądane, bo zmiana projektu i tak czyści filtry po polach z poprzedniego schematu
   * (`docs/frontend/task-management-pages.md` §2.1).
   */
  public readonly filterConfig = computed<ErpFilterConfig>(() => {
    const fields = this._store.filterableFields();

    const config = ErpFilterBuilder.create((b) => {
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
      );

      // Tryb drzewa jest FILTREM, nie przełącznikiem widoku: zmienia to, co serwer zwraca
      // (stronicowanie po korzeniach + poddrzewa), więc jego miejsce jest tam, gdzie reszta
      // parametrów żądania.
      b.addFormField('treeMode', 'checkbox', (f) => f.setLabel(ISSUE_KEYS.filters.treeMode.label));

      // Filtry po polach własnych — wyłącznie po tych ze slotem. Pole bez slotu widać
      // w tabeli, ale filtrowanie po nim wymagałoby skanu jsonb (`task-management.md` §6).
      for (const field of fields) {
        this._addCustomFieldFilter(b, field);
      }
    });

    return config;
  });

  public ngOnInit(): void {
    void this._loadProjects();
  }

  /**
   * Rozdziela wartości formularza na filtry wspólne i filtry po polach własnych.
   *
   * <p>Formularz jest płaski — pola własne siedzą w nim pod swoimi kodami — a kontrakt HTTP
   * ma dla nich osobną listę `customFields`. Tłumaczenie jest tutaj, a nie w store: to widok
   * wie, które klucze formularza są polami z profilu.</p>
   */
  public onSearch(values: Record<string, unknown>): void {
    const codes = new Set(this._store.filterableFields().map((f) => f.code));
    const common: Record<string, unknown> = {};
    const customFields: { code: string; value: string }[] = [];

    for (const [key, value] of Object.entries(values ?? {})) {
      if (!codes.has(key)) {
        common[key] = value;
        continue;
      }

      const text = value === null || value === undefined ? '' : String(value).trim();

      if (text) {
        customFields.push({ code: key, value: text });
      }
    }

    this._store.updateFilters({
      ...(common as Partial<SearchIssueRequest>),
      customFields: customFields.length > 0 ? customFields : undefined,
    });
  }

  /** Pole filtra dobrane do typu danych: słownik i użytkownik dostają picker, reszta tekst.
   * Liczba i data jadą jako tekst, bo backend porównuje je dokładnie do wartości kanonicznej
   * i nie ma tu zakresów — te wejdą razem z zapisanymi widokami (faza 7). */
  private _addCustomFieldFilter(builder: ErpFilterBuilder, field: ProjectFieldDto): void {
    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.User) {
      builder.addFormField(field.code, 'inputPicker', erpUserPickerField(this._directory, { label: field.nameKey }));
      return;
    }

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Select) {
      builder.addFormField(field.code, 'inputPicker', (f) =>
        f
          .setLabel(field.nameKey)
          .setItems(field.options.map((option) => ({ value: option, label: option })))
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      );
      return;
    }

    builder.addFormField(field.code, 'text', (f) => f.setLabel(field.nameKey));
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
