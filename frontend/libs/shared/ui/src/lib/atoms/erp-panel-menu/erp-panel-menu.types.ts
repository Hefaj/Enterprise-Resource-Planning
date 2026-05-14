import { MenuItem } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpPanelMenuConfig {
  items?: MaybeSignal<MenuItem[] | undefined>;
}
