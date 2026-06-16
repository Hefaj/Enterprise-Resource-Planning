import { MenuItem } from 'primeng/api';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export interface ErpContextMenuItem extends Omit<MenuItem, 'label' | 'items'> {
  label?: Translatable;
  items?: ErpContextMenuItem[];
}

export interface ErpContextMenuConfig {
  items?: MaybeSignal<ErpContextMenuItem[] | undefined>;
  global?: MaybeSignal<boolean | undefined>;
}
