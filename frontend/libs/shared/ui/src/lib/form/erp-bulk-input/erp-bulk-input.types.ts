import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpBulkInputConfig extends ErpInputBase {
  label?: MaybeSignal<Translatable | undefined>;
  value?: MaybeSignal<string[] | undefined>;
}
