import { MaybeSignal } from '@erp/shared/ui';

export interface ErpNavigationItem {
  id?: string;
  label: string;
  route?: string | string[];
  iconId?: string;
  disabled?: boolean;
  children?: ErpNavigationItem[];
}

export interface ErpNavigationMenuConfig {
  items: MaybeSignal<ErpNavigationItem[]>;
  showSingle?: MaybeSignal<boolean>;
}