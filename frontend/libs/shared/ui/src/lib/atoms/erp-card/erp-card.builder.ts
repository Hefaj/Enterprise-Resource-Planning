import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpCardConfig } from './erp-card.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpCardBuilder extends ErpBaseBuilder<ErpCardConfig> {
  /** Tekst nagłówka karty (wyświetlany nad tytułem). */
  public setHeader(header: MaybeSignal<string | undefined>): this {
    this._data.header = header;
    return this;
  }

  /** Tytuł karty. */
  public setTitle(title: MaybeSignal<string | undefined>): this {
    this._data.title = title;
    return this;
  }

  /** Podtytuł karty. */
  public setSubtitle(subtitle: MaybeSignal<string | undefined>): this {
    this._data.subtitle = subtitle;
    return this;
  }

  /** Dodatkowa klasa CSS dla zewnętrznego kontenera karty. */
  public setStyleClass(styleClass: MaybeSignal<string | undefined>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  /** Dodatkowa klasa CSS dla obszaru treści karty. */
  public setContentStyleClass(contentStyleClass: MaybeSignal<string | undefined>): this {
    this._data.contentStyleClass = contentStyleClass;
    return this;
  }

  /**
   * Wstrzykuje komponent Angular jako główną treść karty.
   * @param component — Klasa komponentu do renderowania
   * @param config — Inputy przekazywane do komponentu (lub builder)
   */
  public setContentComponent<T = any>(
    component: MaybeSignal<Type<T>>,
    config?: ErpComponentSignalInputs<T> | any
  ): this {
    this._data.contentComponent = component;
    this._data.contentConfig = config;
    return this;
  }

  /**
   * Wstrzykuje komponent Angular jako stopkę karty.
   * @param component — Klasa komponentu do renderowania
   * @param config — Inputy przekazywane do komponentu
   */
  public setFooterComponent<T = any>(
    component: MaybeSignal<Type<T>>,
    config?: ErpComponentSignalInputs<T> | any
  ): this {
    this._data.footerComponent = component;
    this._data.footerConfig = config;
    return this;
  }

  /**
   * Wstrzykuje komponent Angular jako niestandardowy nagłówek karty.
   * @param component — Klasa komponentu do renderowania
   * @param config — Inputy przekazywane do komponentu
   */
  public setHeaderComponent<T = any>(
    component: MaybeSignal<Type<T>>,
    config?: ErpComponentSignalInputs<T> | any
  ): this {
    this._data.headerComponent = component;
    this._data.headerConfig = config;
    return this;
  }
}
