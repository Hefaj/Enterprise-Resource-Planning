import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpCardConfig } from './erp-card.component';
import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpCardBuilder extends ErpBaseBuilder<ErpCardConfig> {
  /** Tekst nagłówka karty (wyświetlany nad tytułem). */
  public setHeader(header: string): this {
    this._data.header = header;
    return this;
  }

  /** Tytuł karty. */
  public setTitle(title: string): this {
    this._data.title = title;
    return this;
  }

  /** Podtytuł karty. */
  public setSubtitle(subtitle: string): this {
    this._data.subtitle = subtitle;
    return this;
  }

  /** Dodatkowa klasa CSS dla zewnętrznego kontenera karty. */
  public setStyleClass(styleClass: string): this {
    this._data.styleClass = styleClass;
    return this;
  }

  /** Dodatkowa klasa CSS dla obszaru treści karty. */
  public setContentStyleClass(contentStyleClass: string): this {
    this._data.contentStyleClass = contentStyleClass;
    return this;
  }

  /**
   * Wstrzykuje komponent Angular jako główną treść karty.
   * @param component — Klasa komponentu do renderowania
   * @param config — Inputy przekazywane do komponentu (lub builder)
   */
  public setContentComponent<TComp>(
    component: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> }
  ): this {
    this._data.contentComponent = component;
    this._data.contentConfig = this._extract(config);
    return this;
  }

  /**
   * Wstrzykuje komponent Angular jako stopkę karty.
   * @param component — Klasa komponentu do renderowania
   * @param config — Inputy przekazywane do komponentu
   */
  public setFooterComponent<TComp>(
    component: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> }
  ): this {
    this._data.footerComponent = component;
    this._data.footerConfig = this._extract(config);
    return this;
  }

  /**
   * Wstrzykuje komponent Angular jako niestandardowy nagłówek karty.
   * @param component — Klasa komponentu do renderowania
   * @param config — Inputy przekazywane do komponentu
   */
  public setHeaderComponent<TComp>(
    component: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> }
  ): this {
    this._data.headerComponent = component;
    this._data.headerConfig = this._extract(config);
    return this;
  }
}
