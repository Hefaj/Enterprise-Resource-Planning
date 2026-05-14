import { MenuItem } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpMenubarConfig {
  items?: MaybeSignal<MenuItem[] | undefined>;
}
