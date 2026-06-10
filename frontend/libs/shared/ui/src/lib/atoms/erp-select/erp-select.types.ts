import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpSelectConfig extends ErpInputBase {
  options?: MaybeSignal<any[] | undefined>;
  optionLabel?: MaybeSignal<string | undefined>;
  optionValue?: MaybeSignal<string | undefined>;
  filter?: MaybeSignal<boolean | undefined>;
  showClear?: MaybeSignal<boolean | undefined>;
  fluid?: MaybeSignal<boolean | undefined>;
}
