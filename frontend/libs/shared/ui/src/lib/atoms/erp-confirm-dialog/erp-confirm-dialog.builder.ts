import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import {
  ErpConfirmAppearance,
  ErpConfirmDialogConfig,
  ErpConfirmKeys,
  ErpConfirmSize,
} from './erp-confirm-dialog.types';

/**
 * Fluent API do złożenia konfiguracji potwierdzenia — patrz docs/frontend/atoms.md.
 */
export class ErpConfirmDialogBuilder extends ErpBaseBuilder<ErpConfirmDialogConfig> {
  /** Klucz tłumaczenia nagłówka (ewentualnie z parametrami), nigdy gotowy tekst. */
  public setTitle(title: MaybeSignal<Translatable>, params?: Record<string, unknown>): this {
    this._data.title = this._withParams(title, params);
    return this;
  }

  /** Klucz zdania mówiącego, co się stanie — z parametrami niosącymi promień rażenia. */
  public setMessage(message: MaybeSignal<Translatable>, params?: Record<string, unknown>): this {
    this._data.message = this._withParams(message, params);
    return this;
  }

  public setDetails(details: MaybeSignal<readonly Translatable[]>): this {
    this._data.details = details;
    return this;
  }

  public setConfirmLabel(label: MaybeSignal<Translatable>): this {
    this._data.confirmLabel = label;
    return this;
  }

  public setCancelLabel(label: MaybeSignal<Translatable>): this {
    this._data.cancelLabel = label;
    return this;
  }

  public setAppearance(appearance: MaybeSignal<ErpConfirmAppearance>): this {
    this._data.appearance = appearance;
    return this;
  }

  /** Skrót na najczęstszy przypadek: akcja, po której nie ma powrotu. */
  public setDestructive(): this {
    this._data.appearance = 'destructive';
    return this;
  }

  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  public setSize(size: ErpConfirmSize): this {
    this._data.size = size;
    return this;
  }

  /** Akcja wykonywana w dialogu — przycisk sam pokaże spinner na czas jej trwania. */
  public setOnConfirm(fn: () => void | Promise<void>): this {
    this._data.onConfirm = fn;
    return this;
  }

  /**
   * Cała czwórka kluczy naraz (`{ title, message, yes, no }`) z jednym kompletem parametrów.
   * Ta gałąź to konwencja słowników modułowych, więc migracja z modułowych serwisów
   * potwierdzeń jest jedną linijką.
   */
  public setKeys(keys: ErpConfirmKeys, params?: Record<string, unknown>): this {
    return this.setTitle(keys.title, params)
      .setMessage(keys.message, params)
      .setConfirmLabel(this._withParams(keys.yes, params))
      .setCancelLabel(keys.no);
  }

  /**
   * Parametry doklejane są tylko wtedy, gdy wywołujący je podał — inaczej `Translatable`
   * ma zostać zwykłym stringiem, bo tak wygląda 90% kluczy w repo.
   */
  private _withParams(
    value: MaybeSignal<Translatable>,
    params?: Record<string, unknown>,
  ): MaybeSignal<Translatable> {
    if (!params || typeof value !== 'string') {
      return value;
    }

    return { key: value, params };
  }
}
