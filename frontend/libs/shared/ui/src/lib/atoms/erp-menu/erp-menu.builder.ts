import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpMenuConfig } from './erp-menu.component';
import { MenuItem } from 'primeng/api';

export class ErpMenuBuilder extends ErpBaseBuilder<ErpMenuConfig> {
  constructor() {
    super();
    this._data.items = [];
    this._data.popup = true;
  }

  public addItem(label: string, icon?: string, command?: (event?: any) => void): this {
    this._data.items?.push({ label, icon, command });
    return this;
  }

  public addSeparator(): this {
    this._data.items?.push({ separator: true });
    return this;
  }

  public addGroup(label: string, items: MenuItem[]): this {
    this._data.items?.push({ label, items });
    return this;
  }

  public setPopup(popup = true): this {
    this._data.popup = popup;
    return this;
  }

  public setItems(items: MenuItem[]): this {
    this._data.items = items;
    return this;
  }
}
