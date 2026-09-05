import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpInputBuilder,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerConfig,
  ErpTranslatePipe,
  Translatable,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, ErpHasPermissionDirective } from '@erp/shared/auth';
import {
  AutomationComparison,
  AutomationRuleDto,
  AutomationRunDto,
  ProjectVM,
  TaskManagementAutomationRuleOrchestrator,
} from '@erp/task-management/data-access';
import {
  AUTOMATION_ACTION_KIND,
  AUTOMATION_COMPARISON_OPERATOR,
  AUTOMATION_FIELD_PATH,
  AUTOMATION_TRIGGER_KIND,
  AutomationActionKindValue,
  AutomationTriggerKindValue,
  ISSUE_PRIORITY,
} from '@erp/task-management/util';
import {
  ErpAutomationActionRow,
  ErpAutomationConditionRow,
  ErpAutomationRuleEditorComponent,
  ErpAutomationRuleEditorConfig,
  ErpProjectConfigurationSectionComponent,
  ErpProjectConfigurationSectionConfig,
  TASKMANAGEMENT_KEYS,
} from '@erp/task-management/ui';

import { PROJECT_KEYS } from '../../translation';

/** Wiersz warunku edytowany w formularzu — jeszcze nie zwalidowany, jeszcze nie AST. */
type ConditionRowState = ErpAutomationConditionRow;

/** Wiersz akcji edytowany w formularzu — pola per rodzaj trzymane naraz, serializowane do
 * `configJson` dopiero przy zapisie (tylko te właściwe dla wybranego `kind`). */
type ActionRowState = ErpAutomationActionRow;

function newActionRow(): ActionRowState {
  return {
    uuid: crypto.randomUUID(),
    kind: AUTOMATION_ACTION_KIND.SetPriority,
    priority: ISSUE_PRIORITY.Normal,
    stateUuid: '',
    assigneeUuid: '',
    tagUuid: '',
    commentBody: '',
    subtaskTypeUuid: '',
    subtaskTitle: '',
  };
}

/**
 * Zakładka „Automatyzacje" na karcie projektu (faza 8, AUT-001/AUT-002) — wzorem „Tagi"/„SLA":
 * lista reguł zarządzana z tej jednej zakładki, edycja w panelu rozwijanym pod listą, nie
 * w osobnym modalu (ten sam wybór co scalanie tagów — drugorzędny, rzadko używany ekran
 * administracyjny nie potrzebuje pełnego cyklu życia modala z `ErpModalService`).
 *
 * <p><b>Warunek budowany strukturalnie</b>, nie przez tekstowy DSL — `AUT-001 if` to ten sam
 * wąski model, co przyszły `guard` (WF-003/DMS §4.4), a nie język wyszukiwania (SRCH-005, poza
 * zakresem tej fazy). Pola referencyjne (stan/typ/tag/przypisany) przyjmują uuid wprost jako
 * tekst — świadoma uproszczona wersja, bez dedykowanych pickerów per pole w tej sesji.</p>
 */
@Component({
  selector: 'erp-task-management-project-automations',
  standalone: true,
  imports: [
    DatePipe,
    ErpAutomationRuleEditorComponent,
    ErpButtonComponent,
    ErpHasPermissionDirective,
    ErpProjectConfigurationSectionComponent,
    ErpTranslatePipe,
  ],
  template: `
    <erp-project-configuration-section [config]="this.sectionConfig">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.automations.title | erpTranslate }}</span>

        <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.AutomationManage">
          @if (this.editingUuid() === null) {
            <erp-button [config]="this.addRuleButton" />
          }
        </ng-container>
      </div>

      @if (this.rulesLoadError()) {
        <div class="flex flex-col items-start gap-2">
          <span class="text-sm text-[var(--tui-status-negative)]">
            {{ PROJECT_KEYS.detail.automations.loadError | erpTranslate }}
          </span>
          <erp-button [config]="retryRulesButton" />
        </div>
      } @else if (this.rules().length === 0 && this.editingUuid() === null) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.automations.empty | erpTranslate }}
        </span>
      }

      @for (rule of this.rules(); track rule.uuid) {
        <div class="rounded-md border border-[var(--tui-border-normal)] p-3">
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-medium" [class.opacity-50]="!rule.isEnabled">{{ rule.name }}</span>
            <span class="text-xs text-[var(--tui-text-secondary)]">{{ this.triggerLabel(rule.triggerKind) }}</span>
            <span class="text-xs text-[var(--tui-text-tertiary)]">
              {{ PROJECT_KEYS.detail.automations.executedCount | erpTranslate: { count: rule.executedCount } }}
            </span>

            <div class="flex-1"></div>

            <erp-button [config]="this.logButton(rule)" />

            <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.AutomationManage">
              <erp-button [config]="this.toggleEnabledButton(rule)" />
              <erp-button [config]="this.editRuleButton(rule)" />
              <erp-button [config]="this.removeRuleButton(rule)" />
            </ng-container>
          </div>

          @if (this.logUuid() === rule.uuid) {
            <div class="mt-2 flex flex-col gap-1 border-t border-[var(--tui-border-normal)] pt-2">
              @if (this.logEntries().length === 0) {
                <span class="text-xs text-[var(--tui-text-secondary)]">
                  {{ PROJECT_KEYS.detail.automations.logEmpty | erpTranslate }}
                </span>
              } @else {
                @for (run of this.logEntries(); track run.uuid) {
                  <div class="flex gap-2 text-xs">
                    <span [class.text-[var(--tui-status-negative)]]="run.outcome === 1">
                      {{ (run.outcome === 1 ? PROJECT_KEYS.detail.automations.outcome.failed : PROJECT_KEYS.detail.automations.outcome.executed) | erpTranslate }}
                    </span>
                    <span class="text-[var(--tui-text-tertiary)]">{{ run.occurredAt | date: 'short' }}</span>
                    @if (run.errorMessage) {
                      <span class="text-[var(--tui-text-secondary)]">{{ run.errorMessage }}</span>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>
      }

      @if (this.editingUuid() !== null) {
        <erp-automation-rule-editor [config]="this.editorConfig()" />
      }
    </erp-project-configuration-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAutomationsComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;
  protected readonly AUTOMATION_ACTION_KIND = AUTOMATION_ACTION_KIND;

  private readonly _rules = inject(TaskManagementAutomationRuleOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _transloco = inject(TranslocoService);
  private readonly _translationsReady = injectTranslationsReadySignal();

  public readonly project = input.required<ProjectVM>();

  protected readonly sectionConfig: ErpProjectConfigurationSectionConfig = {
    title: PROJECT_KEYS.detail.automations.title,
  };

  private readonly _ruleUuids = signal<string[]>([]);
  /** Błąd nie może udawać „brak reguł" — inaczej użytkownik konfiguruje od zera coś, co już
   * istnieje, tylko przejściowo niedostępne. */
  protected readonly rulesLoadError = signal<boolean>(false);
  protected readonly retryRulesButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.retry,
    appearance: 'outline',
    size: 's',
    fn: (): Promise<void> => this._loadAsync(),
  };
  private readonly _saving = signal<boolean>(false);

  protected readonly logUuid = signal<string | null>(null);
  protected readonly logEntries = signal<AutomationRunDto[]>([]);

  protected readonly editingUuid = signal<string | null>(null);
  protected readonly nameControl = new FormControl<string>('', { nonNullable: true });
  protected readonly nameInputConfig: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setPlaceholder(PROJECT_KEYS.detail.automations.editor.namePlaceholder),
  );
  protected readonly triggerControl = new FormControl<AutomationTriggerKindValue>(AUTOMATION_TRIGGER_KIND.IssueCreated, {
    nonNullable: true,
  });
  protected readonly conditionGroups = signal<ConditionRowState[][]>([]);
  protected readonly actionRows = signal<ActionRowState[]>([]);
  private readonly _conditionControls = new Map<string, FormControl<string | number>>();
  private readonly _actionControls = new Map<string, FormControl<string | number>>();

  protected readonly rules = computed<AutomationRuleDto[]>(() => {
    const viewModels = this._rules.getViewModel()();

    return this._ruleUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((rule): rule is AutomationRuleDto => rule !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly fieldOptions = [
    { value: AUTOMATION_FIELD_PATH.Priority, label: PROJECT_KEYS.detail.automations.editor.field.priority },
    { value: AUTOMATION_FIELD_PATH.Type, label: PROJECT_KEYS.detail.automations.editor.field.type },
    { value: AUTOMATION_FIELD_PATH.State, label: PROJECT_KEYS.detail.automations.editor.field.state },
    { value: AUTOMATION_FIELD_PATH.StateCategory, label: PROJECT_KEYS.detail.automations.editor.field.stateCategory },
    { value: AUTOMATION_FIELD_PATH.Assignee, label: PROJECT_KEYS.detail.automations.editor.field.assignee },
    { value: AUTOMATION_FIELD_PATH.Tag, label: PROJECT_KEYS.detail.automations.editor.field.tag },
  ];

  protected readonly operatorOptions = [
    { value: AUTOMATION_COMPARISON_OPERATOR.Eq, label: PROJECT_KEYS.detail.automations.editor.operator.eq },
    { value: AUTOMATION_COMPARISON_OPERATOR.Ne, label: PROJECT_KEYS.detail.automations.editor.operator.ne },
    { value: AUTOMATION_COMPARISON_OPERATOR.Gt, label: PROJECT_KEYS.detail.automations.editor.operator.gt },
    { value: AUTOMATION_COMPARISON_OPERATOR.Gte, label: PROJECT_KEYS.detail.automations.editor.operator.gte },
    { value: AUTOMATION_COMPARISON_OPERATOR.Lt, label: PROJECT_KEYS.detail.automations.editor.operator.lt },
    { value: AUTOMATION_COMPARISON_OPERATOR.Lte, label: PROJECT_KEYS.detail.automations.editor.operator.lte },
  ];

  protected readonly actionKindOptions = [
    { value: AUTOMATION_ACTION_KIND.SetPriority, label: PROJECT_KEYS.detail.automations.editor.action.setPriority },
    { value: AUTOMATION_ACTION_KIND.SetState, label: PROJECT_KEYS.detail.automations.editor.action.setState },
    { value: AUTOMATION_ACTION_KIND.AssignTo, label: PROJECT_KEYS.detail.automations.editor.action.assignTo },
    { value: AUTOMATION_ACTION_KIND.AddTag, label: PROJECT_KEYS.detail.automations.editor.action.addTag },
    { value: AUTOMATION_ACTION_KIND.AddComment, label: PROJECT_KEYS.detail.automations.editor.action.addComment },
    { value: AUTOMATION_ACTION_KIND.SendNotification, label: PROJECT_KEYS.detail.automations.editor.action.sendNotification },
    { value: AUTOMATION_ACTION_KIND.CreateSubtask, label: PROJECT_KEYS.detail.automations.editor.action.createSubtask },
  ];

  protected readonly priorityOptions = computed(() => {
    this._translationsReady();
    return [
      { value: ISSUE_PRIORITY.Lowest, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.lowest) },
      { value: ISSUE_PRIORITY.Low, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.low) },
      { value: ISSUE_PRIORITY.Normal, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.normal) },
      { value: ISSUE_PRIORITY.High, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.high) },
      { value: ISSUE_PRIORITY.Critical, label: this._transloco.translate(TASKMANAGEMENT_KEYS.priority.critical) },
    ];
  });

  protected readonly actionKindPickerConfig = computed<ErpInputPickerConfig>(() => {
    this._translationsReady();
    return ErpInputPickerBuilder.create((builder) =>
      builder
        .setItems(this.actionKindOptions.map((item) => ({ value: item.value, label: this._transloco.translate(item.label) })))
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  });

  protected readonly priorityPickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((builder) =>
      builder.setItems(this.priorityOptions()).setLabelKey('label').setValueKey('value').setStrategy('single'),
    ),
  );

  protected readonly conditionFieldPickerConfig = computed<ErpInputPickerConfig>(() => {
    this._translationsReady();
    return ErpInputPickerBuilder.create((builder) =>
      builder
        .setItems(this.fieldOptions.map((item) => ({ value: item.value, label: this._transloco.translate(item.label) })))
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  });

  protected readonly conditionOperatorPickerConfig = computed<ErpInputPickerConfig>(() => {
    this._translationsReady();
    return ErpInputPickerBuilder.create((builder) =>
      builder
        .setItems(this.operatorOptions.map((item) => ({ value: item.value, label: this._transloco.translate(item.label) })))
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  });

  protected readonly literalInputConfig: ErpInputConfig = ErpInputBuilder.create((builder) =>
    builder.setPlaceholder(PROJECT_KEYS.detail.automations.editor.literalPlaceholder).setSize('s'),
  );

  protected readonly triggerPickerConfig = computed<ErpInputPickerConfig>(() => {
    this._translationsReady();
    return ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.automations.trigger.label)
        .setItems([
          {
            value: AUTOMATION_TRIGGER_KIND.IssueCreated,
            label: this._transloco.translate(PROJECT_KEYS.detail.automations.trigger.issueCreated),
          },
          {
            value: AUTOMATION_TRIGGER_KIND.IssueStateChanged,
            label: this._transloco.translate(PROJECT_KEYS.detail.automations.trigger.issueStateChanged),
          },
          {
            value: AUTOMATION_TRIGGER_KIND.CommentAdded,
            label: this._transloco.translate(PROJECT_KEYS.detail.automations.trigger.commentAdded),
          },
          {
            value: AUTOMATION_TRIGGER_KIND.DueDateElapsed,
            label: this._transloco.translate(PROJECT_KEYS.detail.automations.trigger.dueDateElapsed),
          },
        ])
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  });

  protected triggerLabel(kind: number): string {
    return (
      this.triggerPickerConfig().items as unknown as { value: number; label: string }[]
    ).find((item) => item.value === kind)?.label ?? '';
  }

  protected readonly addRuleButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.addRule,
    appearance: 'primary',
    size: 's',
    fn: (): void => this.startCreate(),
  };

  protected editRuleButton(rule: AutomationRuleDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.automations.edit,
      appearance: 'flat',
      size: 'xs',
      fn: (): void => this.startEdit(rule),
    };
  }

  protected toggleEnabledButton(rule: AutomationRuleDto): ErpButtonConfig {
    return rule.isEnabled
      ? {
          label: PROJECT_KEYS.detail.automations.disable,
          appearance: 'flat',
          size: 'xs',
          fn: (): Promise<void> => this._toggleEnabledAsync(rule, false),
        }
      : {
          label: PROJECT_KEYS.detail.automations.enable,
          appearance: 'flat',
          size: 'xs',
          fn: (): Promise<void> => this._toggleEnabledAsync(rule, true),
        };
  }

  protected removeRuleButton(rule: AutomationRuleDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.automations.remove,
      appearance: 'flat',
      size: 'xs',
      fn: (): Promise<void> => this._removeAsync(rule),
    };
  }

  protected logButton(rule: AutomationRuleDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.automations.log,
      appearance: 'flat',
      size: 'xs',
      fn: (): Promise<void> => this._toggleLogAsync(rule),
    };
  }

  protected readonly addConditionRowButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.editor.addCondition,
    appearance: 'flat',
    size: 'xs',
    fn: (): void => this.addConditionRow(),
  };

  protected readonly addConditionGroupButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.editor.addOrGroup,
    appearance: 'flat',
    size: 'xs',
    fn: (): void => this.addConditionGroup(),
  };

  protected removeConditionRowButton(groupIndex: number, rowIndex: number): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.automations.editor.removeCondition,
      appearance: 'flat',
      size: 'xs',
      fn: (): void => this.removeConditionRow(groupIndex, rowIndex),
    };
  }

  protected readonly addActionButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.editor.addAction,
    appearance: 'flat',
    size: 'xs',
    fn: (): void => this.actionRows.update((rows) => [...rows, newActionRow()]),
  };

  protected removeActionButton(index: number): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.automations.editor.removeAction,
      appearance: 'flat',
      size: 'xs',
      fn: (): void => this.actionRows.update((rows) => rows.filter((_, i) => i !== index)),
    };
  }

  protected readonly cancelEditButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.editor.cancel,
    appearance: 'flat',
    size: 's',
    fn: (): void => this.editingUuid.set(null),
  };

  protected readonly saveRuleButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.automations.editor.save,
    appearance: 'primary',
    size: 's',
    loading: this._saving,
    disabled: computed(() => this.actionRows().length === 0),
    fn: (): Promise<void> => this._saveAsync(),
  };

  /** Adapter granicy feature → ui dla `erp-automation-rule-editor`: stan wierszy, cache
   * kontrolek per komórka i komendy zostają tutaj. */
  protected readonly editorConfig = computed<ErpAutomationRuleEditorConfig>(() => ({
    conditionTitle: PROJECT_KEYS.detail.automations.editor.conditionTitle,
    conditionHint: PROJECT_KEYS.detail.automations.editor.conditionHint,
    orSeparator: PROJECT_KEYS.detail.automations.editor.orSeparator,
    actionsTitle: PROJECT_KEYS.detail.automations.editor.actionsTitle,
    actionRequiredLabel: PROJECT_KEYS.detail.automations.editor.actionRequired,

    nameControl: this.nameControl,
    nameInputConfig: this.nameInputConfig,
    triggerControl: this.triggerControl,
    triggerPickerConfig: this.triggerPickerConfig(),

    conditionGroups: this.conditionGroups(),
    fieldPickerConfig: this.conditionFieldPickerConfig(),
    operatorPickerConfig: this.conditionOperatorPickerConfig(),
    literalInputConfig: this.literalInputConfig,
    getFieldControl: (row, groupIndex, rowIndex): FormControl<string | number> => this.conditionFieldControl(row, groupIndex, rowIndex),
    getOperatorControl: (row, groupIndex, rowIndex): FormControl<string | number> => this.conditionOperatorControl(row, groupIndex, rowIndex),
    getLiteralControl: (row, groupIndex, rowIndex): FormControl<string | number> => this.conditionLiteralControl(row, groupIndex, rowIndex),
    getRemoveConditionRowButton: (groupIndex, rowIndex): ErpButtonConfig => this.removeConditionRowButton(groupIndex, rowIndex),
    addConditionRowButton: this.addConditionRowButton,
    addConditionGroupButton: this.addConditionGroupButton,

    actionKindValues: {
      setPriority: AUTOMATION_ACTION_KIND.SetPriority,
      setState: AUTOMATION_ACTION_KIND.SetState,
      assignTo: AUTOMATION_ACTION_KIND.AssignTo,
      addTag: AUTOMATION_ACTION_KIND.AddTag,
      addComment: AUTOMATION_ACTION_KIND.AddComment,
      createSubtask: AUTOMATION_ACTION_KIND.CreateSubtask,
    },
    actionRows: this.actionRows(),
    actionKindPickerConfig: this.actionKindPickerConfig(),
    priorityPickerConfig: this.priorityPickerConfig(),
    getActionKindControl: (action): FormControl<string | number> => this.actionKindControl(action),
    getActionPriorityControl: (action): FormControl<string | number> => this.actionPriorityControl(action),
    getActionTextControl: (action, field): FormControl<string | number> => this.actionTextControl(action, field),
    actionInputConfig: (placeholder): ErpInputConfig => this.actionInputConfig(placeholder),
    configLabels: {
      stateUuid: PROJECT_KEYS.detail.automations.editor.config.stateUuid,
      assigneeUuid: PROJECT_KEYS.detail.automations.editor.config.assigneeUuid,
      tagUuid: PROJECT_KEYS.detail.automations.editor.config.tagUuid,
      commentBody: PROJECT_KEYS.detail.automations.editor.config.commentBody,
      subtaskTypeUuid: PROJECT_KEYS.detail.automations.editor.config.subtaskTypeUuid,
      subtaskTitle: PROJECT_KEYS.detail.automations.editor.config.subtaskTitle,
    },
    getRemoveActionButton: (index): ErpButtonConfig => this.removeActionButton(index),
    addActionButton: this.addActionButton,

    cancelButton: this.cancelEditButton,
    saveButton: this.saveRuleButton,
  }));

  public constructor() {
    // `project` jest inputem wymaganym, ale nie jest jeszcze zamontowany w chwili wykonania
    // konstruktora — odczyt wprost tutaj kończy się `NG0950`, ten sam błąd co przy
    // `IssueSetProjectStepComponent` w fazie 6 i `ProjectTagsComponent` w fazie 7.
    effect(() => {
      this.project();
      untracked(() => void this._loadAsync());
    });
  }

  protected startCreate(): void {
    this._actionControls.clear();
    this._conditionControls.clear();
    this.editingUuid.set('new');
    this.nameControl.setValue('');
    this.triggerControl.setValue(AUTOMATION_TRIGGER_KIND.IssueCreated);
    this.conditionGroups.set([]);
    this.actionRows.set([newActionRow()]);
  }

  protected startEdit(rule: AutomationRuleDto): void {
    this._actionControls.clear();
    this._conditionControls.clear();
    this.editingUuid.set(rule.uuid);
    this.nameControl.setValue(rule.name);
    this.triggerControl.setValue(rule.triggerKind as AutomationTriggerKindValue);
    this.conditionGroups.set(
      rule.conditionGroups.map((group) =>
        group.map((c: AutomationComparison) => ({ field: c.fieldPath, operator: c.operator, literal: c.literal })),
      ),
    );
    this.actionRows.set(
      rule.actions.map((action) => {
        const config = this._tryParseJson(action.configJson);

        return {
          uuid: action.uuid,
          kind: action.kind as AutomationActionKindValue,
          priority: Number(config['priority'] ?? ISSUE_PRIORITY.Normal),
          stateUuid: String(config['stateUuid'] ?? ''),
          assigneeUuid: String(config['assigneeUuid'] ?? ''),
          tagUuid: String(config['tagUuid'] ?? ''),
          commentBody: String(config['body'] ?? ''),
          subtaskTypeUuid: String(config['typeUuid'] ?? ''),
          subtaskTitle: String(config['title'] ?? ''),
        };
      }),
    );
  }

  protected addConditionRow(): void {
    this.conditionGroups.update((groups) => {
      if (groups.length === 0) {
        return [[this._emptyConditionRow()]];
      }

      const next = groups.map((group) => [...group]);
      next[next.length - 1].push(this._emptyConditionRow());
      return next;
    });
    this._conditionControls.clear();
  }

  protected addConditionGroup(): void {
    this.conditionGroups.update((groups) => [...groups, [this._emptyConditionRow()]]);
    this._conditionControls.clear();
  }

  protected removeConditionRow(groupIndex: number, rowIndex: number): void {
    this.conditionGroups.update((groups) => {
      const next = groups.map((group) => [...group]);
      next[groupIndex].splice(rowIndex, 1);
      return next.filter((group) => group.length > 0);
    });
    this._conditionControls.clear();
  }

  protected updateConditionRow(groupIndex: number, rowIndex: number, patch: Partial<ConditionRowState>): void {
    this.conditionGroups.update((groups) => {
      const next = groups.map((group) => [...group]);
      next[groupIndex][rowIndex] = { ...next[groupIndex][rowIndex], ...patch };
      return next;
    });
    this._conditionControls.clear();
  }

  protected conditionFieldControl(row: ConditionRowState, groupIndex: number, rowIndex: number): FormControl<string | number> {
    return this._conditionControl(row, groupIndex, rowIndex, 'field', row.field, (value) => ({ field: String(value) }));
  }

  protected conditionOperatorControl(row: ConditionRowState, groupIndex: number, rowIndex: number): FormControl<string | number> {
    return this._conditionControl(row, groupIndex, rowIndex, 'operator', row.operator, (value) => ({ operator: Number(value) }));
  }

  protected conditionLiteralControl(row: ConditionRowState, groupIndex: number, rowIndex: number): FormControl<string | number> {
    return this._conditionControl(row, groupIndex, rowIndex, 'literal', row.literal, (value) => ({ literal: String(value) }));
  }

  protected updateAction(index: number, patch: Partial<ActionRowState>): void {
    this.actionRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected actionKindControl(action: ActionRowState): FormControl<string | number> {
    return this._actionControl(action, 'kind', action.kind, (value) => ({ kind: Number(value) as AutomationActionKindValue }));
  }

  protected actionPriorityControl(action: ActionRowState): FormControl<string | number> {
    return this._actionControl(action, 'priority', action.priority, (value) => ({ priority: Number(value) }));
  }

  protected actionTextControl(
    action: ActionRowState,
    field: 'stateUuid' | 'assigneeUuid' | 'tagUuid' | 'commentBody' | 'subtaskTypeUuid' | 'subtaskTitle',
  ): FormControl<string | number> {
    return this._actionControl(action, field, action[field], (value) => ({ [field]: String(value) }));
  }

  protected actionInputConfig(placeholder: Translatable): ErpInputConfig {
    return ErpInputBuilder.create((builder) => builder.setPlaceholder(placeholder).setSize('s'));
  }

  private _emptyConditionRow(): ConditionRowState {
    return { field: AUTOMATION_FIELD_PATH.Priority, operator: AUTOMATION_COMPARISON_OPERATOR.Eq, literal: '' };
  }

  private _actionControl(
    action: ActionRowState,
    field: string,
    value: string | number,
    toPatch: (value: string | number) => Partial<ActionRowState>,
  ): FormControl<string | number> {
    const key = `${action.uuid}:${field}`;
    const existing = this._actionControls.get(key);
    if (existing) {
      return existing;
    }

    const control = new FormControl<string | number>(value, { nonNullable: true });
    control.valueChanges.subscribe((nextValue) => {
      const index = this.actionRows().findIndex((row) => row.uuid === action.uuid);
      if (index >= 0) {
        this.updateAction(index, toPatch(nextValue));
      }
    });
    this._actionControls.set(key, control);
    return control;
  }

  private _conditionControl(
    _row: ConditionRowState,
    groupIndex: number,
    rowIndex: number,
    field: string,
    value: string | number,
    toPatch: (value: string | number) => Partial<ConditionRowState>,
  ): FormControl<string | number> {
    const key = `${groupIndex}:${rowIndex}:${field}`;
    const existing = this._conditionControls.get(key);
    if (existing) {
      return existing;
    }

    const control = new FormControl<string | number>(value, { nonNullable: true });
    control.valueChanges.subscribe((nextValue) => this.updateConditionRow(groupIndex, rowIndex, toPatch(nextValue)));
    this._conditionControls.set(key, control);
    return control;
  }

  private _tryParseJson(json: string): Record<string, string | number> {
    try {
      return JSON.parse(json) as Record<string, string | number>;
    } catch {
      return {};
    }
  }

  private _actionConfigJson(row: ActionRowState): string {
    switch (row.kind) {
      case AUTOMATION_ACTION_KIND.SetPriority:
        return JSON.stringify({ priority: row.priority });
      case AUTOMATION_ACTION_KIND.SetState:
        return JSON.stringify({ stateUuid: row.stateUuid.trim() });
      case AUTOMATION_ACTION_KIND.AssignTo:
        return JSON.stringify({ assigneeUuid: row.assigneeUuid.trim() || null });
      case AUTOMATION_ACTION_KIND.AddTag:
        return JSON.stringify({ tagUuid: row.tagUuid.trim() });
      case AUTOMATION_ACTION_KIND.AddComment:
        return JSON.stringify({ body: row.commentBody });
      case AUTOMATION_ACTION_KIND.SendNotification:
        return '{}';
      case AUTOMATION_ACTION_KIND.CreateSubtask:
        return JSON.stringify({ typeUuid: row.subtaskTypeUuid.trim(), title: row.subtaskTitle || null });
      default:
        return '{}';
    }
  }

  private async _saveAsync(): Promise<void> {
    const name = this.nameControl.value.trim();

    if (!name || this.actionRows().length === 0) {
      return;
    }

    const conditionGroups: AutomationComparison[][] = this.conditionGroups()
      .map((group) => group.filter((row) => row.literal.trim().length > 0).map((row) => ({
        fieldPath: row.field,
        operator: row.operator,
        literal: row.literal.trim(),
      })))
      .filter((group) => group.length > 0);

    const actions = this.actionRows().map((row, index) => ({
      uuid: row.uuid,
      kind: row.kind,
      configJson: this._actionConfigJson(row),
      orderNo: index,
    }));

    this._saving.set(true);

    try {
      const editing = this.editingUuid();

      if (editing === 'new') {
        await this._rules.createMultipleAsync({
          uuid: crypto.randomUUID(),
          projectUuid: this.project().uuid,
          name,
          triggerKind: this.triggerControl.value,
          conditionGroups,
          actions,
        });
      } else if (editing) {
        await this._rules.setMultipleAsync({
          uuid: editing,
          name,
          triggerKind: this.triggerControl.value,
          conditionGroups,
          actions,
        });
      }

      this.editingUuid.set(null);
      await this._loadAsync();
    } catch (error) {
      console.error('[ProjectAutomationsComponent] Nie udało się zapisać reguły automatyzacji.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _toggleEnabledAsync(rule: AutomationRuleDto, enable: boolean): Promise<void> {
    if (enable) {
      await this._rules.execEnableMultipleAsync({ uuid: rule.uuid });
    } else {
      await this._rules.execDisableMultipleAsync({ uuid: rule.uuid });
    }

    await this._loadAsync();
  }

  private async _removeAsync(rule: AutomationRuleDto): Promise<void> {
    await this._confirm.confirmThenAsync(
      {
        title: { key: PROJECT_KEYS.detail.automations.removeConfirm.title, params: { name: rule.name } },
        message: PROJECT_KEYS.detail.automations.removeConfirm.message,
      },
      async () => {
        await this._rules.removeMultipleAsync({ uuid: rule.uuid });
        await this._loadAsync();
      },
    );
  }

  private async _toggleLogAsync(rule: AutomationRuleDto): Promise<void> {
    if (this.logUuid() === rule.uuid) {
      this.logUuid.set(null);
      return;
    }

    this.logUuid.set(rule.uuid);
    this.logEntries.set(await this._rules.getRecentRunsAsync(rule.uuid));
  }

  private async _loadAsync(): Promise<void> {
    this.rulesLoadError.set(false);

    try {
      const rules = await this._rules.searchAutomationRulesAsync({ projectUuid: this.project().uuid });
      this._ruleUuids.set(rules.map((rule) => rule.uuid));
    } catch (error) {
      console.error('[ProjectAutomationsComponent] Nie udało się pobrać listy reguł automatyzacji.', error);
      this.rulesLoadError.set(true);
    }
  }
}
