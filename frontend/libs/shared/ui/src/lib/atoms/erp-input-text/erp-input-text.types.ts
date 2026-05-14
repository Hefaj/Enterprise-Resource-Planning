import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpInputTextConfig extends ErpInputBase {
  icon?: MaybeSignal<string | undefined>;
  fluid?: MaybeSignal<boolean | undefined>;
  size?: MaybeSignal<'small' | 'large' | undefined>;
  variant?: MaybeSignal<'filled' | 'outlined' | undefined>;
}
