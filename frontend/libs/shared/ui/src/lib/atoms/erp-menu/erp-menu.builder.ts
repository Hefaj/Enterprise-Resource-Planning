import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MenuItem } from 'primeng/api';
import { ErpMenuConfig } from './erp-menu.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpMenuBuilder extends ErpBaseBuilder<ErpMenuConfig> {


  public setItems(items: MaybeSignal<MenuItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }

  public setPopup(popup: MaybeSignal<boolean | undefined> = true): this {
    this._data.popup = popup;
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
