import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpStepperConfig {
  steps: MaybeSignal<Translatable[]>;
  activeItemIndex: MaybeSignal<number>;
  orientation?: MaybeSignal<'horizontal' | 'vertical'>;
  activeItemIndexChange?: (index: number) => void;
}
