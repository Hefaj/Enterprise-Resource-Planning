import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpAutoCompleteConfig {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
  suggestions?: MaybeSignal<any[] | undefined>;
  optionLabel?: MaybeSignal<string | undefined>;
  dropdown?: MaybeSignal<boolean | undefined>;
  multiple?: MaybeSignal<boolean | undefined>;
  fluid?: MaybeSignal<boolean | undefined>;
  forceSelection?: MaybeSignal<boolean | undefined>;
  itemComponent?: Type<any>;
  headerComponent?: Type<any>;
  footerComponent?: Type<any>;
}
