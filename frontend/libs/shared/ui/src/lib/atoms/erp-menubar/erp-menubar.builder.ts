import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpMenubarConfig } from './erp-menubar.component';
import { MenuItem } from 'primeng/api';

export class ErpMenubarBuilder extends ErpBaseBuilder<ErpMenubarConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  public addItem(item: MenuItem): this {
    this._data.items?.push(item);
    return this;
  }

  public setItems(items: MenuItem[]): this {
    this._data.items = items;
    return this;
  }
}
