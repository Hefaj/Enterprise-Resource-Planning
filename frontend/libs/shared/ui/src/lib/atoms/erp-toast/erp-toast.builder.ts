import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpToastAction, ErpToastAppearance, ErpToastConfig } from './erp-toast.types';

/**
 * Fluent API do złożenia konfiguracji toasta — patrz docs/guides/frontend/atoms.md.
 */
export class ErpToastBuilder extends ErpBaseBuilder<ErpToastConfig> {
  /** Własny identyfikator, gdy toast ma być później podmieniony w miejscu. */
  public setId(id: string): this {
    this._data.id = id;
    return this;
  }

  /** Klucz tłumaczenia treści (ewentualnie z parametrami), nigdy gotowy tekst. */
  public setMessage(message: MaybeSignal<Translatable>): this {
    this._data.message = message;
    return this;
  }

  public setAppearance(appearance: MaybeSignal<ErpToastAppearance>): this {
    this._data.appearance = appearance;
    return this;
  }

  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  /** `null` = toast zostaje do ręcznego zamknięcia. */
  public setAutoCloseMs(autoCloseMs: number | null): this {
    this._data.autoCloseMs = autoCloseMs;
    return this;
  }

  /**
   * Dokłada akcję. Toast z akcją przestaje znikać sam — inaczej przycisk uciekałby
   * użytkownikowi sprzed kursora.
   */
  public setAction(label: Translatable, fn: () => void | Promise<void>): this {
    this._data.action = { label, fn } satisfies ErpToastAction;
    this._data.autoCloseMs = null;
    return this;
  }
}
