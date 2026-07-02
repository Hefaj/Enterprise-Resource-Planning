import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export interface ErpPanelMenuItem {
  label: string;
  icon?: ErpIcon;
  routerLink?: string;
  disabled?: boolean;
  items?: ErpPanelMenuItem[];
}

export interface ErpPanelMenuConfig {
  items?: MaybeSignal<ErpPanelMenuItem[] | undefined>;
}
