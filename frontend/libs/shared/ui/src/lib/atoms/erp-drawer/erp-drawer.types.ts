import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpDrawerConfig {
  header?: MaybeSignal<string | undefined>;
  footer?: MaybeSignal<string | undefined>;
  styleClass?: MaybeSignal<string | undefined>;
}
