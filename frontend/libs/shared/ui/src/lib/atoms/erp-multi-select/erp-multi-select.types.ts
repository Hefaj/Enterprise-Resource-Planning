import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpMultiSelectConfig {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
  options?: MaybeSignal<any[] | undefined>;
  optionLabel?: MaybeSignal<string | undefined>;
  optionValue?: MaybeSignal<string | undefined>;
  filter?: MaybeSignal<boolean | undefined>;
  display?: MaybeSignal<'comma' | 'chip' | undefined>;
  showHeader?: MaybeSignal<boolean | undefined>;
  fluid?: MaybeSignal<boolean | undefined>;
}
