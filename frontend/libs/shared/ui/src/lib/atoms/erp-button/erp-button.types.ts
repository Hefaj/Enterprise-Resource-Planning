import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export type ErpButtonSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'help' | 'danger' | 'contrast';
export type ErpButtonVariant = 'outlined' | 'text';
export type ErpButtonIconPosition = 'left' | 'right';
export type ErpButtonSize = 'small' | 'large';

export interface ErpButtonConfig {
  label?: MaybeSignal<Translatable | undefined>;
  icon?: MaybeSignal<string | undefined>;
  iconPos?: MaybeSignal<ErpButtonIconPosition | undefined>;
  severity?: MaybeSignal<ErpButtonSeverity | undefined>;
  rounded?: MaybeSignal<boolean | undefined>;
  variant?: MaybeSignal<ErpButtonVariant | undefined>;
  size?: MaybeSignal<ErpButtonSize | undefined>;
  loading?: MaybeSignal<boolean | undefined>;
  disabled?: MaybeSignal<boolean | undefined>;
  badge?: MaybeSignal<string | undefined>;
  onClick?: (event: MouseEvent) => void | Promise<void>;
}

