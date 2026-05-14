import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpDrawerConfig } from './erp-drawer.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpDrawerBuilder extends ErpBaseBuilder<ErpDrawerConfig> {


  public setHeader(header: MaybeSignal<string | undefined>): this {
    this._data.header = header;
    return this;
  }

  public setFooter(footer: MaybeSignal<string | undefined>): this {
    this._data.footer = footer;
    return this;
  }

  public setStyleClass(styleClass: MaybeSignal<string | undefined>): this {
    this._data.styleClass = styleClass;
    return this;
  }
}
