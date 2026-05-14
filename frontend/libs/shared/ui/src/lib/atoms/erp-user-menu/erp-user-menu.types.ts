import { MenuItem } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpUserMenuConfig {
  items?: MaybeSignal<MenuItem[] | undefined>;
  userName?: MaybeSignal<string | undefined>;
  userRole?: MaybeSignal<string | undefined>;
  userImage?: MaybeSignal<string | undefined>;
}
