import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpCardConfig } from './erp-card.component';
import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpCardBuilder extends ErpBaseBuilder<ErpCardConfig> {
  public setHeader(header: string): this {
    this._data.header = header;
    return this;
  }

  public setTitle(title: string): this {
    this._data.title = title;
    return this;
  }

  public setSubtitle(subtitle: string): this {
    this._data.subtitle = subtitle;
    return this;
  }

  public setStyleClass(styleClass: string): this {
    this._data.styleClass = styleClass;
    return this;
  }

  public setContentStyleClass(contentStyleClass: string): this {
    this._data.contentStyleClass = contentStyleClass;
    return this;
  }

  public setContentComponent<TComp>(
    component: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> }
  ): this {
    this._data.contentComponent = component;
    this._data.contentConfig = this._extract(config);
    return this;
  }

  public setFooterComponent<TComp>(
    component: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> }
  ): this {
    this._data.footerComponent = component;
    this._data.footerConfig = this._extract(config);
    return this;
  }

  public setHeaderComponent<TComp>(
    component: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> }
  ): this {
    this._data.headerComponent = component;
    this._data.headerConfig = this._extract(config);
    return this;
  }
}
