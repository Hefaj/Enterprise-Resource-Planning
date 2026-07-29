import { Type } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpFormFieldType } from '../../atoms/erp-step-content/erp-step-content.types';

export interface ErpFilterFieldElement {
  type: 'formField';
  key: string;
  fieldType: ErpFormFieldType | 'custom';
  component: Type<any>;
  config: any;
  value?: MaybeSignal<any> | (() => any);
  onChange?: (value: any) => void;
  colSpan?: MaybeSignal<number>;
  styleClass?: MaybeSignal<string>;
}

export interface ErpFilterGroup {
  key: string;
  title?: MaybeSignal<Translatable>;
  fields: ErpFilterFieldElement[];
  isExpanded?: MaybeSignal<boolean>;
  styleClass?: MaybeSignal<string>;
}

export interface ErpFilterConfig {
  /** Unique key for this filter to save preferences */
  filterKey: string;
  /** Groups of filters */
  groups: ErpFilterGroup[];
  /** FormGroup managing all fields */
  formGroup: FormGroup;
  /** Custom root style class */
  styleClass?: MaybeSignal<string>;
  /** Automatically emit search event when any filter changes */
  autoSearch?: MaybeSignal<boolean>;
  /** Callback wywoływany po zatwierdzeniu wyszukiwania */
  onSearch?: (values: any) => void;
  /** Sygnał lub flaga określająca, czy dane są obecnie ładowane (blokuje przycisk wyszukiwania) */
  isLoading?: MaybeSignal<boolean>;
}
