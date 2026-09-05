import { MaybeSignal } from '@erp/shared/ui';

/** Wspólny nagłówek sekcji konfiguracji projektu; treść pozostaje projekcją komponentu feature. */
export interface ErpProjectConfigurationSectionConfig {
  readonly title: MaybeSignal<string>;
  readonly description?: MaybeSignal<string | undefined>;
}
