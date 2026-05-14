import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpListboxConfig {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
  options?: MaybeSignal<any[] | undefined>;
  optionLabel?: MaybeSignal<string | undefined>;
  optionValue?: MaybeSignal<string | undefined>;
  multiple?: MaybeSignal<boolean | undefined>;
  checkbox?: MaybeSignal<boolean | undefined>;
  filter?: MaybeSignal<boolean | undefined>;
  scrollHeight?: MaybeSignal<string | undefined>;
  itemComponent?: Type<any>;
}
