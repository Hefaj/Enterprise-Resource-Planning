import { FormControl } from '@angular/forms';
import { ErpButtonConfig, ErpInputConfig, ErpInputPickerConfig, Translatable } from '@erp/shared/ui';

/** Wiersz warunku edytowany w formularzu — jeszcze nie zwalidowany, jeszcze nie AST. */
export interface ErpAutomationConditionRow {
  readonly field: string;
  readonly operator: number;
  readonly literal: string;
}

/** Wiersz akcji edytowany w formularzu — pola per rodzaj trzymane naraz; serializacja do
 * `configJson` zostaje po stronie feature, edytor zna tylko to, co trzeba wyrenderować. */
export interface ErpAutomationActionRow {
  readonly uuid: string;
  readonly kind: number;
  readonly priority: number;
  readonly stateUuid: string;
  readonly assigneeUuid: string;
  readonly tagUuid: string;
  readonly commentBody: string;
  readonly subtaskTypeUuid: string;
  readonly subtaskTitle: string;
}

export type ErpAutomationActionTextField = 'stateUuid' | 'assigneeUuid' | 'tagUuid' | 'commentBody' | 'subtaskTypeUuid' | 'subtaskTitle';

/**
 * Konfiguracja edytora reguły automatyzacji (dodanie/edycja) — nazwa, wyzwalacz, grupy warunków
 * (OR między grupami, AND w grupie) i lista akcji zależnych od rodzaju. Warunek budowany
 * strukturalnie, nie przez tekstowy DSL (AUT-001). Feature trzyma stan wierszy i cache
 * `FormControl` per wiersz (klucz: `${uuid}:${pole}`) — edytor tylko woła gettery per komórkę.
 */
export interface ErpAutomationRuleEditorConfig {
  readonly conditionTitle: Translatable;
  readonly conditionHint: Translatable;
  readonly orSeparator: Translatable;
  readonly actionsTitle: Translatable;
  readonly actionRequiredLabel: Translatable;

  readonly nameControl: FormControl<string>;
  readonly nameInputConfig: ErpInputConfig;
  readonly triggerControl: FormControl<number>;
  readonly triggerPickerConfig: ErpInputPickerConfig;

  readonly conditionGroups: readonly (readonly ErpAutomationConditionRow[])[];
  readonly fieldPickerConfig: ErpInputPickerConfig;
  readonly operatorPickerConfig: ErpInputPickerConfig;
  readonly literalInputConfig: ErpInputConfig;
  readonly getFieldControl: (row: ErpAutomationConditionRow, groupIndex: number, rowIndex: number) => FormControl<string | number>;
  readonly getOperatorControl: (row: ErpAutomationConditionRow, groupIndex: number, rowIndex: number) => FormControl<string | number>;
  readonly getLiteralControl: (row: ErpAutomationConditionRow, groupIndex: number, rowIndex: number) => FormControl<string | number>;
  readonly getRemoveConditionRowButton: (groupIndex: number, rowIndex: number) => ErpButtonConfig;
  readonly addConditionRowButton: ErpButtonConfig;
  readonly addConditionGroupButton: ErpButtonConfig;

  /** Wartość `AUTOMATION_ACTION_KIND` — edytor odróżnia pola po rodzaju, nie zna enuma z nazwy. */
  readonly actionKindValues: {
    readonly setPriority: number;
    readonly setState: number;
    readonly assignTo: number;
    readonly addTag: number;
    readonly addComment: number;
    readonly createSubtask: number;
  };
  readonly actionRows: readonly ErpAutomationActionRow[];
  readonly actionKindPickerConfig: ErpInputPickerConfig;
  readonly priorityPickerConfig: ErpInputPickerConfig;
  readonly getActionKindControl: (action: ErpAutomationActionRow) => FormControl<string | number>;
  readonly getActionPriorityControl: (action: ErpAutomationActionRow) => FormControl<string | number>;
  readonly getActionTextControl: (action: ErpAutomationActionRow, field: ErpAutomationActionTextField) => FormControl<string | number>;
  readonly actionInputConfig: (placeholder: Translatable) => ErpInputConfig;
  readonly configLabels: {
    readonly stateUuid: Translatable;
    readonly assigneeUuid: Translatable;
    readonly tagUuid: Translatable;
    readonly commentBody: Translatable;
    readonly subtaskTypeUuid: Translatable;
    readonly subtaskTitle: Translatable;
  };
  readonly getRemoveActionButton: (index: number) => ErpButtonConfig;
  readonly addActionButton: ErpButtonConfig;

  readonly cancelButton: ErpButtonConfig;
  readonly saveButton: ErpButtonConfig;
}
