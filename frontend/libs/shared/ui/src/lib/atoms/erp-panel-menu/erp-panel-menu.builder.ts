import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MenuItem } from 'primeng/api';
import { ErpPanelMenuConfig } from './erp-panel-menu.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpPanelMenuBuilder extends ErpBaseBuilder<ErpPanelMenuConfig> {


  public setItems(items: MaybeSignal<MenuItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }

  public addItem(item: MenuItem): this {
    if (!this._data.items) {
      this._data.items = [];
    }
    if (Array.isArray(this._data.items)) {
      this._data.items.push(item);
    }
    return this;
  }
}
