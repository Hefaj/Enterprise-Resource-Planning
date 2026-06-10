import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpEmptyCardConfig {
  icon?: MaybeSignal<string | undefined>;
  title?: MaybeSignal<string | undefined>;
  subtitle?: MaybeSignal<string | undefined>;
  description?: MaybeSignal<string | undefined>;
  showPulse?: MaybeSignal<boolean | undefined>;
}
