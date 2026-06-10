import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpToggleSwitchConfig {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
}
