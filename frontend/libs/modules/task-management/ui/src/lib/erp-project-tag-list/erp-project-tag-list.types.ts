import { FormControl } from '@angular/forms';

import { ErpButtonConfig, ErpInputConfig, ErpInputPickerConfig, Translatable } from '@erp/shared/ui';

export interface ErpProjectTagMergeConfig {
  readonly message: Translatable;
  readonly pickerConfig: ErpInputPickerConfig;
  readonly pickerControl: FormControl<string | null>;
  readonly confirmButton: ErpButtonConfig;
}

export interface ErpProjectTagListRow {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly editing: boolean;
  readonly merging: boolean;
  readonly actions: readonly ErpButtonConfig[];
  readonly merge?: ErpProjectTagMergeConfig;
}

/** Prezentacyjny model katalogu tagów z edycją i scalaniem w wierszu. */
export interface ErpProjectTagListConfig {
  readonly rows: readonly ErpProjectTagListRow[];
  readonly renameControl: FormControl<string>;
  readonly renameInputConfig: ErpInputConfig;
}
