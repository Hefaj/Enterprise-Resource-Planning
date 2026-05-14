import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpDynamicFilterConfig, ErpDynamicFilterItem } from './erp-dynamic-filter.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpDynamicFilterBuilder extends ErpBaseBuilder<ErpDynamicFilterConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  /**
   * Dodaje filtr dynamiczny do panelu.
   * @param label — Etykieta wyświetlana nad filtrem
   * @param component — Komponent Angular renderowany jako filtr
   * @param inputs — Inputy przekazywane do komponentu
   */
  public addFilter<T>(
    label: MaybeSignal<string | undefined>,
    component: Type<T>,
    inputs: ErpComponentSignalInputs<T>
  ): this {
    if (Array.isArray(this._data.items)) {
      this._data.items.push({ label, component, inputs } as ErpDynamicFilterItem);
    }
    return this;
  }

  /** Zmienia etykietę przycisku zatwierdzającego filtry (domyślnie 'Zastosuj'). */
  public setSubmitButtonLabel(label: MaybeSignal<string | undefined>): this {
    this._data.submitButtonLabel = label;
    return this;
  }

  /** Pokazuje lub ukrywa przycisk zatwierdzający filtry. */
  public setShowSubmitButton(show: MaybeSignal<boolean | undefined>): this {
    this._data.showSubmitButton = show;
    return this;
  }

  /** Ustawia akcję po zatwierdzeniu filtrów. */
  public setOnSubmit(callback: () => void | Promise<void>): this {
    this._data.onSubmit = callback;
    return this;
  }
}
