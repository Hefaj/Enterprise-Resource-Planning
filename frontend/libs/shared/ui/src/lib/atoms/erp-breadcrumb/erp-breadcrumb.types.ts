import { MenuItem } from 'primeng/api';
import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpBreadcrumbConfig {
  home?: MaybeSignal<MenuItem | undefined>;
  items?: MaybeSignal<MenuItem[] | undefined>;
}
