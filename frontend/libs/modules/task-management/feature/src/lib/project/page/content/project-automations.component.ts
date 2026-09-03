import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
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

import { PROJECT_KEYS } from '../../translation';

/** Wiersz warunku edytowany w formularzu — jeszcze nie zwalidowany, jeszcze nie AST. */
interface ConditionRowState {
  field: string;
  operator: number;
  literal: string;
}

/** Wiersz akcji edytowany w formularzu — pola per rodzaj trzymane naraz, serializowane do
 * `configJson` dopiero przy zapisie (tylko te właściwe dla wybranego `kind`). */
interface ActionRowState {
  uuid: string;
  kind: AutomationActionKindValue;
  priority: number;
  stateUuid: string;
  assigneeUuid: string;
  tagUuid: string;
  commentBody: string;
  subtaskTypeUuid: string;
  subtaskTitle: string;
}

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
    ErpButtonComponent,
    ErpHasPermissionDirective,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.automations.title | erpTranslate }}</span>

        <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.AutomationManage">
          @if (this.editingUuid() === null) {
            <erp-button [config]="this.addRuleButton" />
          }
        </ng-container>
      </div>

      @if (this.rules().length === 0 && this.editingUuid() === null) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.automations.empty | erpTranslate }}
        </span>
      }

      @for (rule of this.rules(); track rule.uuid) {
        <div class="rounded-md border border-[var(--tui-border-normal)] p-3">
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-medium" [class.opacity-50]="!rule.isEnabled">{{ rule.name }}</span>
            <span class="text-xs text-[var(--tui-text-secondary)]">{{ this.triggerLabel(rule.triggerKind) | erpTranslate }}</span>
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
        <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-3">
          <input
            class="w-full rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-sm"
            type="text"
            [formControl]="this.nameControl"
            [placeholder]="PROJECT_KEYS.detail.automations.editor.namePlaceholder | erpTranslate"
          />

          <erp-input-picker class="w-64" [config]="this.triggerPickerConfig" [control]="this.triggerControl" />

          <div class="flex flex-col gap-2">
            <span class="text-xs font-medium">{{ PROJECT_KEYS.detail.automations.editor.conditionTitle | erpTranslate }}</span>
            <span class="text-xs text-[var(--tui-text-secondary)]">
              {{ PROJECT_KEYS.detail.automations.editor.conditionHint | erpTranslate }}
            </span>

            @for (group of this.conditionGroups(); track $index; let groupIndex = $index) {
              @if (groupIndex > 0) {
                <span class="text-xs font-medium text-[var(--tui-text-tertiary)]">
                  {{ PROJECT_KEYS.detail.automations.editor.orSeparator | erpTranslate }}
                </span>
              }

              @for (row of group; track $index; let rowIndex = $index) {
                <div class="flex flex-wrap items-center gap-2">
                  <select
                    class="rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                    [value]="row.field"
                    (change)="this.updateConditionRow(groupIndex, rowIndex, { field: $any($event.target).value })"
                  >
                    @for (field of this.fieldOptions; track field.value) {
                      <option [value]="field.value">{{ field.label | erpTranslate }}</option>
                    }
                  </select>

                  <select
                    class="rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                    [value]="row.operator"
                    (change)="this.updateConditionRow(groupIndex, rowIndex, { operator: +$any($event.target).value })"
                  >
                    @for (op of this.operatorOptions; track op.value) {
                      <option [value]="op.value">{{ op.label | erpTranslate }}</option>
                    }
                  </select>

                  <input
                    class="w-40 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                    type="text"
                    [value]="row.literal"
                    [placeholder]="PROJECT_KEYS.detail.automations.editor.literalPlaceholder | erpTranslate"
                    (input)="this.updateConditionRow(groupIndex, rowIndex, { literal: $any($event.target).value })"
                  />

                  <erp-button [config]="this.removeConditionRowButton(groupIndex, rowIndex)" />
                </div>
              }
            }

            <div class="flex gap-2">
              <erp-button [config]="this.addConditionRowButton" />
              <erp-button [config]="this.addConditionGroupButton" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-xs font-medium">{{ PROJECT_KEYS.detail.automations.editor.actionsTitle | erpTranslate }}</span>

            @for (action of this.actionRows(); track action.uuid; let actionIndex = $index) {
              <div class="flex flex-wrap items-center gap-2 rounded border border-[var(--tui-border-normal)] p-2">
                <select
                  class="rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                  [value]="action.kind"
                  (change)="this.updateAction(actionIndex, { kind: $any(+$any($event.target).value) })"
                >
                  @for (kind of this.actionKindOptions; track kind.value) {
                    <option [value]="kind.value">{{ kind.label | erpTranslate }}</option>
                  }
                </select>

                @switch (action.kind) {
                  @case (AUTOMATION_ACTION_KIND.SetPriority) {
                    <select
                      class="rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      [value]="action.priority"
                      (change)="this.updateAction(actionIndex, { priority: +$any($event.target).value })"
                    >
                      @for (priority of this.priorityOptions; track priority.value) {
                        <option [value]="priority.value">{{ priority.label }}</option>
                      }
                    </select>
                  }
                  @case (AUTOMATION_ACTION_KIND.SetState) {
                    <input
                      class="w-56 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      type="text"
                      [value]="action.stateUuid"
                      [placeholder]="PROJECT_KEYS.detail.automations.editor.config.stateUuid | erpTranslate"
                      (input)="this.updateAction(actionIndex, { stateUuid: $any($event.target).value })"
                    />
                  }
                  @case (AUTOMATION_ACTION_KIND.AssignTo) {
                    <input
                      class="w-56 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      type="text"
                      [value]="action.assigneeUuid"
                      [placeholder]="PROJECT_KEYS.detail.automations.editor.config.assigneeUuid | erpTranslate"
                      (input)="this.updateAction(actionIndex, { assigneeUuid: $any($event.target).value })"
                    />
                  }
                  @case (AUTOMATION_ACTION_KIND.AddTag) {
                    <input
                      class="w-56 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      type="text"
                      [value]="action.tagUuid"
                      [placeholder]="PROJECT_KEYS.detail.automations.editor.config.tagUuid | erpTranslate"
                      (input)="this.updateAction(actionIndex, { tagUuid: $any($event.target).value })"
                    />
                  }
                  @case (AUTOMATION_ACTION_KIND.AddComment) {
                    <input
                      class="w-72 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      type="text"
                      [value]="action.commentBody"
                      [placeholder]="PROJECT_KEYS.detail.automations.editor.config.commentBody | erpTranslate"
                      (input)="this.updateAction(actionIndex, { commentBody: $any($event.target).value })"
                    />
                  }
                  @case (AUTOMATION_ACTION_KIND.CreateSubtask) {
                    <input
                      class="w-56 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      type="text"
                      [value]="action.subtaskTypeUuid"
                      [placeholder]="PROJECT_KEYS.detail.automations.editor.config.subtaskTypeUuid | erpTranslate"
                      (input)="this.updateAction(actionIndex, { subtaskTypeUuid: $any($event.target).value })"
                    />
                    <input
                      class="w-56 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-xs"
                      type="text"
                      [value]="action.subtaskTitle"
                      [placeholder]="PROJECT_KEYS.detail.automations.editor.config.subtaskTitle | erpTranslate"
                      (input)="this.updateAction(actionIndex, { subtaskTitle: $any($event.target).value })"
                    />
                  }
                }

                <erp-button [config]="this.removeActionButton(actionIndex)" />
              </div>
            }

            <erp-button [config]="this.addActionButton" />

            @if (this.actionRows().length === 0) {
              <span class="text-xs text-[var(--tui-status-negative)]">
                {{ PROJECT_KEYS.detail.automations.editor.actionRequired | erpTranslate }}
              </span>
            }
          </div>

          <div class="flex justify-end gap-2">
            <erp-button [config]="this.cancelEditButton" />
            <erp-button [config]="this.saveRuleButton" />
          </div>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAutomationsComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;
  protected readonly AUTOMATION_ACTION_KIND = AUTOMATION_ACTION_KIND;

  private readonly _rules = inject(TaskManagementAutomationRuleOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);

  public readonly project = input.required<ProjectVM>();

  private readonly _ruleUuids = signal<string[]>([]);
  private readonly _saving = signal<boolean>(false);

  protected readonly logUuid = signal<string | null>(null);
  protected readonly logEntries = signal<AutomationRunDto[]>([]);

  protected readonly editingUuid = signal<string | null>(null);
  protected readonly nameControl = new FormControl<string>('', { nonNullable: true });
  protected readonly triggerControl = new FormControl<AutomationTriggerKindValue>(AUTOMATION_TRIGGER_KIND.IssueCreated, {
    nonNullable: true,
  });
  protected readonly conditionGroups = signal<ConditionRowState[][]>([]);
  protected readonly actionRows = signal<ActionRowState[]>([]);

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

  protected readonly priorityOptions = [
    { value: ISSUE_PRIORITY.Lowest, label: 'Lowest' },
    { value: ISSUE_PRIORITY.Low, label: 'Low' },
    { value: ISSUE_PRIORITY.Normal, label: 'Normal' },
    { value: ISSUE_PRIORITY.High, label: 'High' },
    { value: ISSUE_PRIORITY.Critical, label: 'Critical' },
  ];

  protected readonly triggerPickerConfig: ErpInputPickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.automations.trigger.label)
      .setItems([
        { value: AUTOMATION_TRIGGER_KIND.IssueCreated, label: PROJECT_KEYS.detail.automations.trigger.issueCreated },
        { value: AUTOMATION_TRIGGER_KIND.IssueStateChanged, label: PROJECT_KEYS.detail.automations.trigger.issueStateChanged },
        { value: AUTOMATION_TRIGGER_KIND.CommentAdded, label: PROJECT_KEYS.detail.automations.trigger.commentAdded },
        { value: AUTOMATION_TRIGGER_KIND.DueDateElapsed, label: PROJECT_KEYS.detail.automations.trigger.dueDateElapsed },
      ])
      .setLabelKey('label')
      .setValueKey('value')
      .setStrategy('single'),
  );

  protected triggerLabel(kind: number): string {
    return (
      this.triggerPickerConfig.items as unknown as { value: number; label: string }[]
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
    fn: (): void => this.conditionGroups.update((groups) => [...groups, [this._emptyConditionRow()]]),
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
    this.editingUuid.set('new');
    this.nameControl.setValue('');
    this.triggerControl.setValue(AUTOMATION_TRIGGER_KIND.IssueCreated);
    this.conditionGroups.set([]);
    this.actionRows.set([newActionRow()]);
  }

  protected startEdit(rule: AutomationRuleDto): void {
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
  }

  protected removeConditionRow(groupIndex: number, rowIndex: number): void {
    this.conditionGroups.update((groups) => {
      const next = groups.map((group) => [...group]);
      next[groupIndex].splice(rowIndex, 1);
      return next.filter((group) => group.length > 0);
    });
  }

  protected updateConditionRow(groupIndex: number, rowIndex: number, patch: Partial<ConditionRowState>): void {
    this.conditionGroups.update((groups) => {
      const next = groups.map((group) => [...group]);
      next[groupIndex][rowIndex] = { ...next[groupIndex][rowIndex], ...patch };
      return next;
    });
  }

  protected updateAction(index: number, patch: Partial<ActionRowState>): void {
    this.actionRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  private _emptyConditionRow(): ConditionRowState {
    return { field: AUTOMATION_FIELD_PATH.Priority, operator: AUTOMATION_COMPARISON_OPERATOR.Eq, literal: '' };
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
    try {
      const rules = await this._rules.searchAutomationRulesAsync({ projectUuid: this.project().uuid });
      this._ruleUuids.set(rules.map((rule) => rule.uuid));
    } catch (error) {
      console.error('[ProjectAutomationsComponent] Nie udało się pobrać listy reguł automatyzacji.', error);
    }
  }
}
