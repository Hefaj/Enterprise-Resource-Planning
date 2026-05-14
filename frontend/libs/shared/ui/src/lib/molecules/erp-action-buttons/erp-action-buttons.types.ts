import { ErpButtonConfig } from '../../atoms/erp-button';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpActionItem extends ErpButtonConfig {
  id: string;
}

export interface ErpActionButtonsConfig {
  buttons: MaybeSignal<ErpActionItem[]>;
  alignment?: MaybeSignal<'start' | 'end' | 'center' | 'between' | undefined>;
  gap?: MaybeSignal<number | undefined>;
}
