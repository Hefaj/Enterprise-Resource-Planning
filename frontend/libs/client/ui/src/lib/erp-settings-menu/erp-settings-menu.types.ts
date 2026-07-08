import { MaybeSignal, Translatable, ErpIcon } from '@erp/shared/ui';

export interface ErpSettingsMenuItem {
  id: string;
  label: MaybeSignal<Translatable>;
  icon?: MaybeSignal<ErpIcon>;
  fn?: () => void | Promise<void>;
  active?: MaybeSignal<boolean>;
  children?: MaybeSignal<ErpSettingsMenuItem[]>;
  separator?: boolean;
  disabled?: MaybeSignal<boolean>;
}

export interface ErpSettingsMenuConfig {
  items: ErpSettingsMenuItem[];
}
