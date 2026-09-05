import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe } from '@erp/shared/ui';

import { ErpAutomationRuleEditorConfig } from './erp-automation-rule-editor.types';

/**
 * Formularz dodania/edycji reguły automatyzacji (AUT-001/AUT-002) — nazwa, wyzwalacz, grupy
 * warunków (OR między grupami) i lista akcji zależnych od rodzaju.
 *
 * <p><b>Warunek budowany strukturalnie</b>, nie przez tekstowy DSL — to ten sam wąski model,
 * co przyszły `guard` (WF-003/DMS §4.4), a nie język wyszukiwania (SRCH-005, poza zakresem).
 * Feature trzyma cache `FormControl` per wiersz i wszystkie komendy; edytor tylko renderuje.</p>
 */
@Component({
  selector: 'erp-automation-rule-editor',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    @let c = config();
    <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-3">
      <erp-input [config]="c.nameInputConfig" [control]="c.nameControl" />

      <erp-input-picker class="w-64" [config]="c.triggerPickerConfig" [control]="c.triggerControl" />

      <div class="flex flex-col gap-2">
        <span class="text-xs font-medium">{{ c.conditionTitle | erpTranslate }}</span>
        <span class="text-xs text-[var(--tui-text-secondary)]">{{ c.conditionHint | erpTranslate }}</span>

        @for (group of c.conditionGroups; track $index; let groupIndex = $index) {
          @if (groupIndex > 0) {
            <span class="text-xs font-medium text-[var(--tui-text-tertiary)]">{{ c.orSeparator | erpTranslate }}</span>
          }

          @for (row of group; track $index; let rowIndex = $index) {
            <div class="flex flex-wrap items-center gap-2">
              <erp-input-picker class="w-40" [config]="c.fieldPickerConfig" [control]="c.getFieldControl(row, groupIndex, rowIndex)" />
              <erp-input-picker class="w-40" [config]="c.operatorPickerConfig" [control]="c.getOperatorControl(row, groupIndex, rowIndex)" />
              <erp-input class="w-40" [config]="c.literalInputConfig" [control]="c.getLiteralControl(row, groupIndex, rowIndex)" />

              <erp-button [config]="c.getRemoveConditionRowButton(groupIndex, rowIndex)" />
            </div>
          }
        }

        <div class="flex gap-2">
          <erp-button [config]="c.addConditionRowButton" />
          <erp-button [config]="c.addConditionGroupButton" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-xs font-medium">{{ c.actionsTitle | erpTranslate }}</span>

        @for (action of c.actionRows; track action.uuid; let actionIndex = $index) {
          <div class="flex flex-wrap items-center gap-2 rounded border border-[var(--tui-border-normal)] p-2">
            <erp-input-picker class="w-52" [config]="c.actionKindPickerConfig" [control]="c.getActionKindControl(action)" />

            @switch (action.kind) {
              @case (c.actionKindValues.setPriority) {
                <erp-input-picker class="w-44" [config]="c.priorityPickerConfig" [control]="c.getActionPriorityControl(action)" />
              }
              @case (c.actionKindValues.setState) {
                <erp-input class="w-56" [config]="c.actionInputConfig(c.configLabels.stateUuid)" [control]="c.getActionTextControl(action, 'stateUuid')" />
              }
              @case (c.actionKindValues.assignTo) {
                <erp-input class="w-56" [config]="c.actionInputConfig(c.configLabels.assigneeUuid)" [control]="c.getActionTextControl(action, 'assigneeUuid')" />
              }
              @case (c.actionKindValues.addTag) {
                <erp-input class="w-56" [config]="c.actionInputConfig(c.configLabels.tagUuid)" [control]="c.getActionTextControl(action, 'tagUuid')" />
              }
              @case (c.actionKindValues.addComment) {
                <erp-input class="w-72" [config]="c.actionInputConfig(c.configLabels.commentBody)" [control]="c.getActionTextControl(action, 'commentBody')" />
              }
              @case (c.actionKindValues.createSubtask) {
                <erp-input class="w-56" [config]="c.actionInputConfig(c.configLabels.subtaskTypeUuid)" [control]="c.getActionTextControl(action, 'subtaskTypeUuid')" />
                <erp-input class="w-56" [config]="c.actionInputConfig(c.configLabels.subtaskTitle)" [control]="c.getActionTextControl(action, 'subtaskTitle')" />
              }
            }

            <erp-button [config]="c.getRemoveActionButton(actionIndex)" />
          </div>
        }

        <erp-button [config]="c.addActionButton" />

        @if (c.actionRows.length === 0) {
          <span class="text-xs text-[var(--tui-status-negative)]">{{ c.actionRequiredLabel | erpTranslate }}</span>
        }
      </div>

      <div class="flex justify-end gap-2">
        <erp-button [config]="c.cancelButton" />
        <erp-button [config]="c.saveButton" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpAutomationRuleEditorComponent {
  public readonly config = input.required<ErpAutomationRuleEditorConfig>();
}
