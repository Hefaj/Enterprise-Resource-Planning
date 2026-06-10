import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpDatePickerConfig {
  placeholder?: MaybeSignal<string | undefined>;
  hint?: MaybeSignal<string | undefined>;
  errorMessages?: MaybeSignal<Record<string, string> | undefined>;
  showIcon?: MaybeSignal<boolean | undefined>;
  dateFormat?: MaybeSignal<string | undefined>;
  selectionMode?: MaybeSignal<'single' | 'multiple' | 'range' | undefined>;
  view?: MaybeSignal<'date' | 'month' | 'year' | undefined>;
  showTime?: MaybeSignal<boolean | undefined>;
  hourFormat?: MaybeSignal<'12' | '24' | undefined>;
}
