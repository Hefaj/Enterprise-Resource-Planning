import { MaybeSignal } from '@erp/shared/ui';

export interface ErpNavigationItem {
  id?: string;
  label: string;
  labelKey?: string;
  route?: string | string[];
  iconId?: string;
  disabled?: boolean;
  children?: ErpNavigationItem[];
  /** Kod uprawnienia wymagany, żeby pozycja była widoczna — filtrowane w `STARTUP.ts`
   * przed rejestracją, więc tu pole jest już tylko pamiętane dla zgodności typów. */
  requiredPermission?: string;
}

export interface ErpNavigationMenuConfig {
  items: MaybeSignal<ErpNavigationItem[]>;
  showSingle?: MaybeSignal<boolean>;
}
