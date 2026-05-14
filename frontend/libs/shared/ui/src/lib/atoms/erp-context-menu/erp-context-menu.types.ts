import { MenuItem } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpContextMenuConfig {
  items?: MaybeSignal<MenuItem[] | undefined>;
  global?: MaybeSignal<boolean | undefined>;
}
