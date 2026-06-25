import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpHostLayoutConfig } from './erp-host-layout.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpHostLayoutBuilder extends ErpBaseBuilder<ErpHostLayoutConfig> {
  public constructor() {
    super();
    this._data = {};
  }

  public setCloseMenuOnNavigation(close: MaybeSignal<boolean>): this {
    this._data.closeMenuOnNavigation = close;
    return this;
  }
}
