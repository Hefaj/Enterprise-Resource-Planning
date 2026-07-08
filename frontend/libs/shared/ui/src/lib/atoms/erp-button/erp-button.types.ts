import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export type ErpButtonAppearance =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'flat'
  | 'outline'
  | 'destructive'
  | 'outline-grayscale'
  | 'icon';

export type ErpButtonSize = 'xs' | 's' | 'm' | 'l';

export interface ErpButtonConfig {
  label?: MaybeSignal<Translatable>;
  size?: MaybeSignal<ErpButtonSize>;
  appearance?: MaybeSignal<ErpButtonAppearance>;
  loading?: MaybeSignal<boolean>;
  disabled?: MaybeSignal<boolean>;
  iconStart?: MaybeSignal<ErpIcon>;
  iconEnd?: MaybeSignal<ErpIcon>;
  fn?: () => void | Promise<void>;
}
