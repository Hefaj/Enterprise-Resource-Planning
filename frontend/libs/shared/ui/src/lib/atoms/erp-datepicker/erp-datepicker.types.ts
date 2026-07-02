import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { TuiDay } from '@taiga-ui/cdk/date-time';

export interface ErpDatePickerConfig extends ErpInputBase {
  /** Minimum selectable date */
  min?: MaybeSignal<TuiDay | null | undefined>;
  /** Maximum selectable date */
  max?: MaybeSignal<TuiDay | null | undefined>;
  /** Icon displayed inside the textfield (default: '@tui.calendar') */
  icon?: MaybeSignal<string | undefined>;
  /** Whether the component stretches to fill its container */
  fluid?: MaybeSignal<boolean | undefined>;
  /** Textfield size: 'small' | 'large' (default: medium) */
  size?: MaybeSignal<'small' | 'large' | undefined>;
}
