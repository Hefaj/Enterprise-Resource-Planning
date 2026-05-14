import { MenuItem } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpMenuConfig {
  items?: MaybeSignal<MenuItem[] | undefined>;
  popup?: MaybeSignal<boolean | undefined>;
}
