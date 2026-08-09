import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export interface ErpEmptyStateConfig {
  /** Ikona wyświetlana nad komunikatem. */
  icon?: MaybeSignal<ErpIcon>;
  /** Treść komunikatu (translatable). */
  message: MaybeSignal<Translatable>;
}
