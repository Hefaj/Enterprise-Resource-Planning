import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MenuItem } from 'primeng/api';
import { ErpMenubarConfig } from './erp-menubar.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpMenubarBuilder extends ErpBaseBuilder<ErpMenubarConfig> {


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
