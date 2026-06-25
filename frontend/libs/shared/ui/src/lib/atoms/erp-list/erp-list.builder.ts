import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpListConfig } from './erp-list.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K
} extends { [_ in keyof T]: infer U } ? U & string : never;

/**
 * Builder służący do deklaratywnej konfiguracji komponentu erp-list.
 */
export class ErpListBuilder<TItem = any> extends ErpBaseBuilder<ErpListConfig> {
  /**
   * Ustawia elementy listy, które mają zostać wyświetlone.
   */
  public setItems(items: MaybeSignal<TItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }

  /**
   * Definiuje nazwę pola lub funkcję selektora w obiekcie elementu, która ma służyć jako etykieta (label) elementu.
   */
  public setItemLabel(label: KnownKeys<TItem>): this;
  public setItemLabel(label: (item: TItem) => string): this;
  public setItemLabel(label: MaybeSignal<KnownKeys<TItem> | ((item: TItem) => string) | undefined>): this;
  public setItemLabel(label: any): this {
    this._data.itemLabel = label;
    return this;
  }

  /**
   * Definiuje nazwę pola lub funkcję selektora w obiekcie elementu, która ma służyć jako wartość (value) elementu.
   */
  public setItemValue(value: KnownKeys<TItem>): this;
  public setItemValue(value: (item: TItem) => any): this;
  public setItemValue(value: MaybeSignal<KnownKeys<TItem> | ((item: TItem) => any) | undefined>): this;
  public setItemValue(value: any): this {
    this._data.itemValue = value;
    return this;
  }

  /**
   * Włącza lub wyłącza wirtualne przewijanie (Virtual Scroll) wraz z określeniem wysokości pojedynczego wiersza.
   */
  public setVirtualScroll(virtualScroll: MaybeSignal<boolean | undefined> = true, itemSize: MaybeSignal<number | undefined> = 35): this {
    this._data.virtualScroll = virtualScroll;
    this._data.virtualScrollItemSize = itemSize;
    return this;
  }

  /**
   * Ustawia listę w tryb tylko do odczytu (blokuje interakcje).
   */
  public setReadonly(readonly: MaybeSignal<boolean | undefined> = true): this {
    this._data.readonly = readonly;
    return this;
  }

  /**
   * Określa tryb wyboru elementów na liście ('single', 'multiple', lub 'none').
   */
  public setSelectionMode(mode: MaybeSignal<'single' | 'multiple' | 'none' | undefined>): this {
    this._data.selectionMode = mode;
    return this;
  }

  /**
   * Określa, czy dozwolony jest wybór wielu elementów naraz.
   */
  public setMultiple(multiple: MaybeSignal<boolean | undefined> = true): this {
    this._data.multiple = multiple;
    return this;
  }

  /**
   * Włącza wyświetlanie checkboxów obok elementów przy wielokrotnym wyborze.
   */
  public setCheckbox(checkbox: MaybeSignal<boolean | undefined> = true): this {
    this._data.checkbox = checkbox;
    return this;
  }

  /**
   * Włącza filtrowanie (wyszukiwarkę) elementów listy wraz z opcjonalnym tekstem pomocniczym (placeholder).
   */
  public setFilter(filter: MaybeSignal<boolean | undefined> = true, placeholder?: MaybeSignal<string | undefined>): this {
    this._data.filter = filter;
    this._data.filterPlaceholder = placeholder;
    return this;
  }

  /**
   * Definiuje wysokość obszaru przewijania listy (np. '250px').
   */
  public setScrollHeight(height: MaybeSignal<string | undefined>): this {
    this._data.scrollHeight = height;
    return this;
  }

  /**
   * Pozwala na wstrzyknięcie własnego dedykowanego komponentu do renderowania pojedynczego elementu na liście.
   */
  public setItemComponent<T>(component: MaybeSignal<Type<T> | undefined>): this {
    this._data.itemComponent = component;
    return this;
  }

  /**
   * Ustawia tekst placeholder (np. etykietę/tytuł nad całą listą).
   */
  public setPlaceholder(placeholder: MaybeSignal<string | undefined>): this {
    this._data.placeholder = placeholder;
    return this;
  }

  /**
   * Ustawia tekst podpowiedzi (hint) wyświetlany pod listą.
   */
  public setHint(hint: MaybeSignal<string | undefined>): this {
    this._data.hint = hint;
    return this;
  }

  /**
   * Definiuje komunikaty błędów walidacji powiązane z kluczami błędów formularza.
   */
  public setErrorMessages(messages: MaybeSignal<Record<string, string> | undefined>): this {
    this._data.errorMessages = messages;
    return this;
  }
}
