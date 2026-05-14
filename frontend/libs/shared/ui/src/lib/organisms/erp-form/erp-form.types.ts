import { Type } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

/**
 * Kontrakt dla dowolnego komponentu, który ma być użyty w ErpForm.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ErpFormAtom<TComp = any> {
  config: ErpComponentSignalInputs<TComp>;
  control: FormControl;
}

export type ErpFormFieldType = 'text' | 'select' | 'datepicker' | 'multiselect' | 'autocomplete' | 'listbox' | 'toggle' | 'custom';

export interface ErpFormField {
  key: string;
  type: ErpFormFieldType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  colSpan?: MaybeSignal<number | undefined>;
  component?: Type<any>; // Używane tylko dla typu 'custom'
}

export interface ErpFormConfig {
  fields: MaybeSignal<ErpFormField[]>;
  gridCols?: MaybeSignal<number | undefined>;
  formGroup: FormGroup;
}
