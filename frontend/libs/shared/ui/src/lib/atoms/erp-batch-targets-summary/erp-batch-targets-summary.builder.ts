import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpBatchTargetItem, ErpBatchTargetsSummaryConfig } from './erp-batch-targets-summary.types';

/**
 * Fluent Builder dla `ErpBatchTargetsSummary` — podsumowania celów kroku modalu
 * operacji masowej, wyświetlanego jako baner w stylu `erp-selection-scope-banner`
 * (komunikat "Edytujesz N pozycji" + lista nazw / hint trybu filtra).
 *
 * @example
 * ```ts
 * // Budowane zwykle w konstruktorze kroku PRZED `super()` — stąd gettery (`() => this...`),
 * // nie bezpośrednie odczyty `this.pole` (pola bazy `ErpBatchStepBase` jeszcze nie istnieją).
 * const config = ErpStepContentBuilder.create(b => b
 *   .addBatchTargetsSummary(s => s
 *     .setItems(() => this.targetItems())
 *     .setTargetCount(() => this.targetCount())
 *     .setIsFilterMode(() => this.isFilterMode())
 *     .setMessages({
 *       messageKey: PRODUCT_KEYS.commands.setName.editMessage,
 *       suffixSingleKey: PRODUCT_KEYS.commands.setName.productSuffixSingle,
 *       suffixPluralKey: PRODUCT_KEYS.commands.setName.productSuffixPlural,
 *       filterModeSuffixKey: PRODUCT_KEYS.commands.setName.filterModeSuffix,
 *       filterModeHintKey: PRODUCT_KEYS.commands.setName.filterModeHint,
 *     })
 *     .setLoadingKey(PRODUCT_KEYS.base.loading),
 *   )
 *   .addFormField('name', 'text', ...)
 * );
 * ```
 */
export class ErpBatchTargetsSummaryBuilder extends ErpBaseBuilder<ErpBatchTargetsSummaryConfig> {
  public constructor() {
    super();
    this._data.items = [];
  }

  /** Ustawia listę celów (nazwy w opisie banera) w trybie jawnych identyfikatorów. Przyjmuje też getter — patrz typ. */
  public setItems(items: MaybeSignal<ErpBatchTargetItem[]> | (() => ErpBatchTargetItem[])): this {
    this._data.items = items;
    return this;
  }

  /** Ustawia liczbę pozycji objętych operacją. Przyjmuje też getter — patrz typ. */
  public setTargetCount(count: MaybeSignal<number> | (() => number)): this {
    this._data.targetCount = count;
    return this;
  }

  /** Ustawia tryb „Zaznacz wszystko" (komenda niesie filtr zamiast identyfikatorów). Przyjmuje też getter. */
  public setIsFilterMode(isFilterMode: MaybeSignal<boolean> | (() => boolean)): this {
    this._data.isFilterMode = isFilterMode;
    return this;
  }

  /** Ustawia komplet kluczy tłumaczeń komunikatu głównego i trybu filtra. */
  public setMessages(messages: {
    messageKey: MaybeSignal<Translatable>;
    suffixSingleKey: MaybeSignal<Translatable>;
    suffixPluralKey: MaybeSignal<Translatable>;
    filterModeSuffixKey: MaybeSignal<Translatable>;
    filterModeHintKey: MaybeSignal<Translatable>;
  }): this {
    this._data.messageKey = messages.messageKey;
    this._data.suffixSingleKey = messages.suffixSingleKey;
    this._data.suffixPluralKey = messages.suffixPluralKey;
    this._data.filterModeSuffixKey = messages.filterModeSuffixKey;
    this._data.filterModeHintKey = messages.filterModeHintKey;
    return this;
  }

  /** Ustawia klucz tekstu pokazywany, gdy nie ma żadnych celów (ani uuidów, ani filtra). */
  public setEmptyKey(key: MaybeSignal<Translatable>): this {
    this._data.emptyKey = key;
    return this;
  }

  /** Ustawia klucz placeholdera dla pozycji, której `label` jeszcze wynosi `null`. */
  public setLoadingKey(key: MaybeSignal<Translatable>): this {
    this._data.loadingKey = key;
    return this;
  }
}
