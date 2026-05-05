import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpContextMenuConfig } from './erp-context-menu.component';
import { MenuItem } from 'primeng/api';

export class ErpContextMenuBuilder extends ErpBaseBuilder<ErpContextMenuConfig> {
  constructor() {
    super();
    this._data.items = [];
    this._data.global = false;
  }

  public addItem(item: MenuItem): this {
    this._data.items?.push(item);
    return this;
  }

  public setGlobal(global = true): this {
    this._data.global = global;
    return this;
  }

  public setItems(items: MenuItem[]): this {
    this._data.items = items;
    return this;
  }
}
