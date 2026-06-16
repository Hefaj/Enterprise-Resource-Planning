import { MaybeSignal } from '../../base/erp-signal-utils';

export type ErpTextTag = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface ErpTextConfig {
  value: MaybeSignal<string | string[] | undefined>;
  params?: MaybeSignal<Record<string, unknown> | undefined>;
  tag?: MaybeSignal<ErpTextTag | undefined>;
  class?: MaybeSignal<string | undefined>;
}
