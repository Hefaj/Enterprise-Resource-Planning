import { ChangeDetectionStrategy, Component, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Validators } from '@angular/forms';

import { ErpBatchStepBase, ErpBatchTargetItem, ErpStepContentBuilder, ErpStepContentComponent, ErpStepContentConfig } from '@erp/shared/ui';
import {
  BatchCommandOfIssueAddTagCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
  TaskManagementTagOrchestrator,
} from '@erp/task-management/data-access';

import { IssueSetStateMetadata } from '../issue-set-state/issue-set-state.definition';
import { ISSUE_KEYS } from '../../translation';

/**
 * Krok modalu seryjnego dopięcia tagu: podsumowanie celów + picker tagu projektu z kontekstu.
 *
 * <p>Rozwiązanie projektu tą samą metodą co {@link IssueSetStateStepComponent} — z metadanych,
 * z filtra celów albo, gdy wszystkie zaznaczone zgłoszenia należą do jednego projektu, z niego.
 * Bez projektu picker jest pusty, bo tagi są zasobem per projekt (plus globalne).</p>
 */
@Component({
  selector: 'erp-task-management-issue-add-tag-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueAddTagStepComponent extends ErpBatchStepBase<
  BatchCommandOfIssueAddTagCommandAndSearchIssueRequest,
  IssueSetStateMetadata
> {
  private readonly _issues: TaskManagementIssueOrchestrator;
  private readonly _tags: TaskManagementTagOrchestrator;
  private readonly _tagUuids = signal<string[]>([]);

  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const issues = inject(TaskManagementIssueOrchestrator);
    const tags = inject(TaskManagementTagOrchestrator);

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

    const tagOptions = computed(() => {
      const viewModels = tags.getViewModel()();
      return this._tagUuids()
        .map((uuid) => viewModels.get(uuid))
        .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined)
        .map((tag) => ({ uuid: tag.uuid, label: tag.name }))
        .sort((left, right) => left.label.localeCompare(right.label));
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
              messageKey: ISSUE_KEYS.commands.addTag.editMessage,
              suffixSingleKey: ISSUE_KEYS.commands.setState.issueSuffixSingle,
              suffixPluralKey: ISSUE_KEYS.commands.setState.issueSuffixPlural,
              filterModeSuffixKey: ISSUE_KEYS.commands.setState.filterModeSuffix,
              filterModeHintKey: ISSUE_KEYS.commands.setState.filterModeHint,
            }),
        )
        .addFormField(
          'tagUuid',
          'inputPicker',
          (f) => f.setLabel(ISSUE_KEYS.commands.addTag.tagLabel).setItems(tagOptions).setLabelKey('label').setValueKey('uuid').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().templateCommand?.tagUuid ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                templateCommand: { ...cmd.templateCommand, tagUuid: value ?? undefined },
              })),
          },
        ),
    );

    super(config);

    this._issues = issues;
    this._tags = tags;
    this.targetItems = computed(() => {
      const viewModels = this._issues.getViewModel()();
      return this.targetUuids()
        .map((uuid) => viewModels.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined)
        .map((vm) => ({ uuid: vm.uuid, label: `${vm.key} — ${vm.title}` }));
    });
    this.formContent = config;

    effect(() => {
      const uuid = projectUuid();
      untracked(() => void this._loadTagsAsync(uuid));
    });
  }

  private async _loadTagsAsync(projectUuid: string | null): Promise<void> {
    if (!projectUuid) {
      this._tagUuids.set([]);
      return;
    }

    try {
      const tags = await this._tags.searchTagsAsync({ projectUuid });
      this._tagUuids.set(tags.map((tag) => tag.uuid));
    } catch (error) {
      console.error('[IssueAddTagStepComponent] Nie udało się pobrać tagów projektu.', error);
    }
  }
}
