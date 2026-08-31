import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';

import { ErpBatchStepBase, ErpBatchTargetItem, ErpStepContentBuilder, ErpStepContentComponent, ErpStepContentConfig } from '@erp/shared/ui';
import { BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, TaskManagementIssueOrchestrator, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

/**
 * Krok modalu przeniesienia: podsumowanie celów + wybór projektu docelowego.
 *
 * <p>Pole jest wymagane — inaczej niż przy przypisaniu osoby, gdzie pusta wartość znaczy
 * „zdejmij przypisanie". Zgłoszenie bez projektu nie istnieje: projekt jest granicą numeracji
 * i widoczności.</p>
 */
@Component({
  selector: 'erp-task-management-issue-set-project-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueSetProjectStepComponent extends ErpBatchStepBase<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest> {
  private readonly _issues: TaskManagementIssueOrchestrator;

  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const issues = inject(TaskManagementIssueOrchestrator);
    const projects = inject(TaskManagementProjectOrchestrator);

    const projectOptions = computed(() =>
      [...projects.getViewModel()().values()].map((project) => ({ value: project.uuid, label: `${project.code} — ${project.name}` })),
    );

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: ISSUE_KEYS.commands.setProject.editMessage,
              suffixSingleKey: ISSUE_KEYS.commands.setState.issueSuffixSingle,
              suffixPluralKey: ISSUE_KEYS.commands.setState.issueSuffixPlural,
              filterModeSuffixKey: ISSUE_KEYS.commands.setState.filterModeSuffix,
              filterModeHintKey: ISSUE_KEYS.commands.setState.filterModeHint,
            }),
        )
        .addFormField(
          'projectUuid',
          'inputPicker',
          (f) => f.setLabel(ISSUE_KEYS.commands.setProject.projectLabel).setHint(ISSUE_KEYS.commands.setProject.hint).setItems(projectOptions).setLabelKey('label').setValueKey('value').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().templateCommand?.projectUuid ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                templateCommand: { ...cmd.templateCommand, projectUuid: (value as string) ?? undefined },
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
