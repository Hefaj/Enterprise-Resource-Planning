import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export type ErpButtonAppearance =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'mono'
  | 'outline'
  | 'flat'
  | 'glass'
  | 'destructive'
  | 'white-block'
  | 'flat-destructive'
  | 'outline-destructive';

export type ErpButtonSize = 'xs' | 's' | 'm' | 'l' | 'xl';

export interface ErpButtonConfig {
  label?: MaybeSignal<Translatable | undefined>;
  appearance?: MaybeSignal<ErpButtonAppearance | undefined>;
  size?: MaybeSignal<ErpButtonSize | undefined>;
  iconStart?: MaybeSignal<ErpIcon | undefined>;
  iconEnd?: MaybeSignal<ErpIcon | undefined>;
  loading?: MaybeSignal<boolean | undefined>;
  disabled?: MaybeSignal<boolean | undefined>;
  onClick?: (event: MouseEvent) => void | Promise<void>;
}
