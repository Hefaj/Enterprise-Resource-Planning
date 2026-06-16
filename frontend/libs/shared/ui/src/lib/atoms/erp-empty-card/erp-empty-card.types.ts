import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpEmptyCardConfig {
  icon?: MaybeSignal<string | undefined>;
  title?: MaybeSignal<Translatable | undefined>;
  subtitle?: MaybeSignal<Translatable | undefined>;
  description?: MaybeSignal<Translatable | undefined>;
  showPulse?: MaybeSignal<boolean | undefined>;
}
