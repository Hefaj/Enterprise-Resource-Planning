import { ErpBaseBuilder, MaybeSignal, Translatable } from '@erp/shared/ui';
import { ErpProductDraftRowsConfig } from './erp-product-draft-rows.types';

/** Fluent API do złożenia konfiguracji edytora wierszy nowych produktów. */
export class ErpProductDraftRowsBuilder extends ErpBaseBuilder<ErpProductDraftRowsConfig> {
  public setNameLabel(label: MaybeSignal<Translatable>): this {
    this._data.nameLabel = label;
    return this;
  }

  public setNamePlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.namePlaceholder = placeholder;
    return this;
  }

  public setPriceLabel(label: MaybeSignal<Translatable>): this {
    this._data.priceLabel = label;
    return this;
  }

  public setPricePlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.pricePlaceholder = placeholder;
    return this;
  }

  /** Komunikaty walidacji pojedynczego wiersza (nazwa wymagana, cena wymagana/ujemna). */
  public setErrorMessages(messages: {
    nameRequired?: MaybeSignal<Translatable | undefined>;
    priceRequired?: MaybeSignal<Translatable | undefined>;
    priceMin?: MaybeSignal<Translatable | undefined>;
  }): this {
    this._data.nameRequiredError = messages.nameRequired;
    this._data.priceRequiredError = messages.priceRequired;
    this._data.priceMinError = messages.priceMin;
    return this;
  }

  public setActionLabels(add: MaybeSignal<Translatable>, remove: MaybeSignal<Translatable>): this {
    this._data.addRowLabel = add;
    this._data.removeRowLabel = remove;
    return this;
  }

  public setMaxRows(maxRows: MaybeSignal<number | undefined>): this {
    this._data.maxRows = maxRows;
    return this;
  }

  /** Podmienia generator uuid — przydatne w testach, gdzie identyfikatory mają być powtarzalne. */
  public setNewUuid(factory: () => string): this {
    this._data.newUuid = factory;
    return this;
  }
}
