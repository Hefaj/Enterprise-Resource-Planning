import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpBreadcrumbItem {
  id?: string;
  label?: Translatable;
  routerLink?: string | string[];
  iconId?: string;
}

export interface ErpBreadcrumbConfig {
  items: MaybeSignal<ErpBreadcrumbItem[]>;
}
