import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpAvatarConfig {
  shape?: MaybeSignal<'square' | 'circle' | undefined>;
  size?: MaybeSignal<'normal' | 'large' | 'xlarge' | undefined>;
  label?: MaybeSignal<string | undefined>;
  icon?: MaybeSignal<string | undefined>;
  image?: MaybeSignal<string | undefined>;
}
