import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpInputSize } from '../erp-input/erp-input.types';
import { ErpInputPickerConfig, ErpInputPickerStrategy, ErpInputPickerSearchQuery } from './erp-input-picker.types';

/**
 * Klasa Builder dla komponentu ErpInputPicker, udostępniająca płynne (fluent) API
 * do konfiguracji pola wyboru wartości z zawężaniem (single/multi).
 */
export class ErpInputPickerBuilder<T = any, V = any> extends ErpInputBaseBuilder<ErpInputPickerConfig<T, V>> {
  /**
   * Ustawia listę dostępnych opcji do wyboru.
   * @param items Statyczna lista lub sygnał z listą opcji.
   */
  public setItems(items: MaybeSignal<readonly T[]>): this {
    this._data.items = items;
    return this;
  }

  /**
   * Ustawia strategię wyboru ('single' dla wyboru pojedynczego lub 'multi' dla wielokrotnego z checkboxami).
   * @param strategy 'single' | 'multi'
   */
  public setStrategy(strategy: MaybeSignal<ErpInputPickerStrategy>): this {
    this._data.strategy = strategy;
    return this;
  }

  /**
   * Ustawia klucz właściwości obiektu do wyświetlania na liście i w polu tekstowym (np. 'name').
   * @param labelKey Nazwa właściwości.
   */
  public setLabelKey(labelKey: MaybeSignal<keyof T | string | undefined>): this {
    this._data.labelKey = labelKey;
    return this;
  }

  /**
   * Ustawia klucz właściwości obiektu jako wartość zwracaną i zapisywaną w modelu formularza (np. 'id').
   * @param valueKey Nazwa właściwości.
   */
  public setValueKey(valueKey: MaybeSignal<keyof T | string | undefined>): this {
    this._data.valueKey = valueKey;
    return this;
  }

  /**
   * Ustawia własną funkcję transformującą obiekt T na tekst wyświetlany (zamiast labelKey).
   * @param extractor Funkcja transformująca obiekt na string lub sygnał z tą funkcją.
   */
  public setDisplayExtractor(extractor: MaybeSignal<((item: T) => string) | undefined>): this {
    this._data.displayExtractor = extractor;
    return this;
  }

  /**
   * Ustawia własną funkcję transformującą obiekt T na wartość zwracaną V (zamiast valueKey).
   * @param extractor Funkcja transformująca obiekt na wartość modelową lub sygnał z tą funkcją.
   */
  public setValueExtractor(extractor: MaybeSignal<((item: T) => V) | undefined>): this {
    this._data.valueExtractor = extractor;
    return this;
  }

  /**
   * Ustawia pływającą etykietę (floating label) pola.
   * @param label Tekst etykiety lub klucz tłumaczenia.
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia początkową/domyślną wartość formularzową dla komponentu.
   * @param value Wartość pojedyncza (dla strategy='single') lub tablica wartości (dla strategy='multi').
   */
  public setValue(value: MaybeSignal<any>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia tekst zastępczy (placeholder) wyszukiwania.
   * @param placeholder Tekst lub klucz tłumaczenia.
   */
  public setSearchPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.searchPlaceholder = placeholder;
    return this;
  }

  /**
   * Ustawia komunikat wyświetlany, gdy brak wyników filtrowania.
   * @param content Tekst lub klucz tłumaczenia.
   */
  public setEmptyContent(content: MaybeSignal<Translatable | undefined>): this {
    this._data.emptyContent = content;
    return this;
  }

  /**
   * Określa, czy w trybie pojedynczym dozwolone jest wyłacznie wybranie opcji z listy (strict=true).
   * @param strict Statyczny boolean lub sygnał (domyślnie true).
   */
  public setStrict(strict: MaybeSignal<boolean>): this {
    this._data.strict = strict;
    return this;
  }

  /**
   * Ustawia rozmiar pola input ('s', 'm', 'l').
   * @param size Dostępne rozmiary.
   */
  public setSize(size: MaybeSignal<ErpInputSize>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Włącza wirtualizację listy opcji przy użyciu Angular CDK Virtual Scroll.
   * Zalecane dla list zawierających > ~200 pozycji.
   * @param itemSize Wysokość pojedynczego elementu listy w px (domyślnie 40).
   *                 Można też podać `true` aby użyć wartości domyślnej.
   */
  public setVirtualScroll(itemSize: MaybeSignal<boolean | number> = true): this {
    this._data.virtualScroll = itemSize;
    return this;
  }

  /**
   * Dla wyboru wielokrotnego ('multi'): ustawia maksymalną liczbę wyświetlanych elementów,
   * po przekroczeniu której wyświetlany jest napis "Zaznaczone (X)".
   * @param count Maksymalna liczba elementów w postaci sygnału lub wartości statycznej.
   */
  public setMaxCollapseCount(count: MaybeSignal<number>): this {
    this._data.maxCollapseCount = count;
    return this;
  }

  /**
   * Ustawia asynchroniczną funkcję wyszukującą i paginującą, która przyjmuje filtry
   * ({ search, pageIndex, pageSize }) i zwraca listę dopasowanych identyfikatorów/UUID.
   */
  public setSearchFn(fn: MaybeSignal<((query: ErpInputPickerSearchQuery) => any) | undefined>): this {
    this._data.searchFn = fn;
    return this;
  }

  /**
   * Ustawia asynchroniczną funkcję pobierającą pełne obiekty (T[]) na podstawie listy identyfikatorów/UUID.
   */
  public setGetFn(fn: MaybeSignal<((uuids: string[]) => any) | undefined>): this {
    this._data.getFn = fn;
    return this;
  }

  /**
   * Ustawia rozmiar pojedynczej strony podczas asynchronicznej paginacji (domyślnie 50).
   */
  public setPageSize(size: MaybeSignal<number>): this {
    this._data.pageSize = size;
    return this;
  }
}
