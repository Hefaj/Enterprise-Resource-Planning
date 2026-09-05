import { FormControl } from '@angular/forms';
import { ErpButtonConfig, ErpInputConfig, Translatable } from '@erp/shared/ui';
import { ErpWorkflowTransitionCellConfig } from '../erp-workflow-transition-cell';

/** Stan macierzy (kolumny i wiersze), niezależny od DTO backendu — tylko to, co renderuje siatkę. */
export interface ErpWorkflowEditorState {
  readonly uuid: string;
  readonly code: string;
}

/** Komórka wybrana do edycji — `transitionUuid` puste oznacza tworzenie nowego przejścia. */
export interface ErpWorkflowEditorSelectedCell {
  readonly fromStateCode: string;
  readonly toStateCode: string;
  readonly hasExistingTransition: boolean;
}

/**
 * Konfiguracja edytora macierzy przejść „z → do". Feature dostarcza stany, komórki (już
 * ukształtowane przez `erp-workflow-transition-cell`), wybraną komórkę i kontrolki formularza —
 * edytor renderuje siatkę i panel edycji, bez znajomości DTO ani orkiestratora.
 */
export interface ErpWorkflowEditorConfig {
  readonly title: Translatable;
  readonly matrixHint: Translatable;
  readonly emptyLabel: Translatable;
  readonly states: readonly ErpWorkflowEditorState[];
  readonly getCellConfig: (fromState: ErpWorkflowEditorState, toState: ErpWorkflowEditorState) => ErpWorkflowTransitionCellConfig;

  readonly selectedCell: ErpWorkflowEditorSelectedCell | null;
  readonly formTitle: (cell: ErpWorkflowEditorSelectedCell) => Translatable;
  readonly nameKeyControl: FormControl<string | null>;
  readonly nameKeyInputConfig: ErpInputConfig;
  readonly permissionControl: FormControl<string | null>;
  readonly permissionInputConfig: ErpInputConfig;
  readonly fieldsControl: FormControl<string | null>;
  readonly fieldsInputConfig: ErpInputConfig;
  readonly removeButton?: ErpButtonConfig;
  readonly cancelButton: ErpButtonConfig;
  readonly saveButton: ErpButtonConfig;
}
