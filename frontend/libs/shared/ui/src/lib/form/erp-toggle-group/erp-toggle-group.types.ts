import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpToggleItemConfig extends ErpInputBase {
  value: any;
  /** Pominięty dla pozycji tylko-ikona (tooltip przejmuje wtedy rolę etykiety). */
  text?: MaybeSignal<Translatable>;
  subtext?: MaybeSignal<Translatable>;
  iconStart?: MaybeSignal<string>;
  iconEnd?: MaybeSignal<string>;
}

export interface ErpToggleGroupConfig extends ErpInputBase {
  direction?: MaybeSignal<'horizontal' | 'vertical'>;
  mode: 'single' | 'multi';
  items: ErpToggleItemConfig[];
  size?: MaybeSignal<'s' | 'm' | 'l'>;
}
