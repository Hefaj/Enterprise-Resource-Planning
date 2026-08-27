import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpBatchStepBase,
  ErpBatchTargetItem,
  ErpStepContentBuilder,
  ErpStepContentComponent,
  ErpStepContentConfig,
} from '@erp/shared/ui';
import {
  BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
  ProjectWorkflowService,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';

import { IssueSetStateMetadata } from './issue-set-state.definition';
import { ISSUE_KEYS } from '../../translation';

/**
 * Krok modalu seryjnej zmiany stanu: podsumowanie celów + picker stanu docelowego.
 *
 * <p>Lista stanów pochodzi ze schematu projektu, więc istnieje tylko przy jednym projekcie
 * w zasięgu. Gdy zaznaczenie obejmuje kilka projektów, pole jest puste, a nad nim stoi
 * komunikat — zapis blokuje `Validators.required` na pustym pickerze.</p>
 */
@Component({
  selector: 'erp-task-management-issue-set-state-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueSetStateStepComponent extends ErpBatchStepBase<
  BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
  IssueSetStateMetadata
> {
  private readonly _issues: TaskManagementIssueOrchestrator;

  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Zależności do zmiennych lokalnych — `super()` jeszcze nie wystartował.
    const issues = inject(TaskManagementIssueOrchestrator);
    const workflow = inject(ProjectWorkflowService);
    const transloco = inject(TranslocoService);

    /** Projekt kontekstu: z metadanych strony, z filtra celów albo — gdy cele są znane —
     * jedyny projekt wspólny dla wszystkich zaznaczonych zgłoszeń. */
    const projectUuid = computed<string | null>(() => {
      const command = this.command()();
      const fromMetadata = this.metadata()()?.projectUuid ?? command.targetFilter?.projectUuid;
      if (fromMetadata) {
        return fromMetadata;
      }

      const viewModels = issues.getViewModel()();
      const projects = new Set(
        (command.targetUuids ?? [])
          .map((uuid) => viewModels.get(uuid)?.projectUuid)
          .filter((uuid): uuid is string => !!uuid),
      );

      return projects.size === 1 ? [...projects][0] : null;
    });

    const stateOptions = computed(() => {
      const uuid = projectUuid();
      if (!uuid) {
        return [];
      }

      return workflow.statesOf(uuid)().map((state) => ({
        uuid: state.uuid,
        label: state.nameKey ? transloco.translate(state.nameKey) : state.code,
      }));
    });

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: ISSUE_KEYS.commands.setState.editMessage,
              suffixSingleKey: ISSUE_KEYS.commands.setState.issueSuffixSingle,
              suffixPluralKey: ISSUE_KEYS.commands.setState.issueSuffixPlural,
              filterModeSuffixKey: ISSUE_KEYS.commands.setState.filterModeSuffix,
              filterModeHintKey: ISSUE_KEYS.commands.setState.filterModeHint,
            }),
        )
        .addText(computed(() => (stateOptions().length === 0 ? ISSUE_KEYS.commands.setState.noProjectContext : '')))
        .addFormField(
          'stateUuid',
          'inputPicker',
          (f) =>
            f
              .setLabel(ISSUE_KEYS.commands.setState.stateLabel)
              .setItems(stateOptions)
              .setLabelKey('label')
              .setValueKey('uuid')
              .setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().templateCommand?.stateUuid ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                templateCommand: { ...cmd.templateCommand, stateUuid: value ?? undefined },
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
