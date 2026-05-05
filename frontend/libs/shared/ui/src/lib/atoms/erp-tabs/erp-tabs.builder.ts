import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTabsConfig, ErpTabItem } from './erp-tabs.component';

export class ErpTabsBuilder extends ErpBaseBuilder<ErpTabsConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  public addTab(label: string, value: string | number, icon?: string, disabled = false): this {
    this._data.items?.push({ label, value, icon, disabled });
    return this;
  }

  public setItems(items: ErpTabItem[]): this {
    this._data.items = items;
    return this;
  }
}
