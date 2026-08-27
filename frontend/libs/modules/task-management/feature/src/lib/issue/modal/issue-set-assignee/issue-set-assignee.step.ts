import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';

import {
  ErpBatchStepBase,
  ErpBatchTargetItem,
  ErpStepContentBuilder,
  ErpStepContentComponent,
  ErpStepContentConfig,
  erpUserPickerField,
} from '@erp/shared/ui';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';
import {
  BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

/**
 * Krok modalu seryjnego przypisania: podsumowanie celów + wybór osoby ze wspólnego katalogu.
 *
 * <p><b>Pole nie ma `Validators.required`</b>, i to jest różnica wobec kroku zmiany stanu:
 * puste pole znaczy tutaj „zdejmij przypisanie”, czyli poprawną operację. Stan pusty nie
 * istnieje, osoba pusta — owszem.</p>
 *
 * <p>Lista osób pochodzi z <c>ERP_USER_DIRECTORY</c>, nie z backendu Task Management: ten sam
 * katalog obsługuje DMS i każdy kolejny moduł, który wskazuje ludzi
 * (<c>docs/frontend/user-directory.md</c>).</p>
 */
@Component({
  selector: 'erp-task-management-issue-set-assignee-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueSetAssigneeStepComponent extends ErpBatchStepBase<BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest> {
  private readonly _issues: TaskManagementIssueOrchestrator;

  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Zależności do zmiennych lokalnych — `super()` jeszcze nie wystartował.
    const issues = inject(TaskManagementIssueOrchestrator);
    const directory = inject(ERP_USER_DIRECTORY, { optional: true });

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: ISSUE_KEYS.commands.setAssignee.editMessage,
              suffixSingleKey: ISSUE_KEYS.commands.setState.issueSuffixSingle,
              suffixPluralKey: ISSUE_KEYS.commands.setState.issueSuffixPlural,
              filterModeSuffixKey: ISSUE_KEYS.commands.setState.filterModeSuffix,
              filterModeHintKey: ISSUE_KEYS.commands.setState.filterModeHint,
            }),
        )
        .addFormField(
          'assigneeUuid',
          'inputPicker',
          erpUserPickerField(directory, { label: ISSUE_KEYS.commands.setAssignee.userLabel }),
          {
            value: () => this.command()().templateCommand?.assigneeUuid ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                // `undefined` zamiast `null`: komenda backendu czyta brak wartości jako
                // zdjęcie przypisania (`IssueSetAssigneeCommand.AssigneeUuid`).
                templateCommand: { ...cmd.templateCommand, assigneeUuid: value ?? undefined },
              })),
          },
        ),
    );

    super(config);

    this._issues = issues;
    this.targetItems = computed(() => {
      const viewModels = this._issues.getViewModel()();
      return this.targetUuids()
        .map((uuid) => viewModels.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined)
        .map((vm) => ({ uuid: vm.uuid, label: `${vm.key} — ${vm.title}` }));
    });
    this.formContent = config;
  }
}
