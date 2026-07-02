import { MaybeSignal } from '../../base/erp-signal-utils';

export interface ErpBreadcrumbItem {
  id?: string;
  label?: string;
  routerLink?: string | string[];
  iconId?: string;
}

export interface ErpBreadcrumbConfig {
  home?: MaybeSignal<ErpBreadcrumbItem | undefined>;
  items?: MaybeSignal<ErpBreadcrumbItem[] | undefined>;
}
