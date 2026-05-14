import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpInputTextConfig {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
  icon?: MaybeSignal<string | undefined>;
  fluid?: MaybeSignal<boolean | undefined>;
  size?: MaybeSignal<'small' | 'large' | undefined>;
  variant?: MaybeSignal<'filled' | 'outlined' | undefined>;
}
