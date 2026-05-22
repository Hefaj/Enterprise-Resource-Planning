import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MenuItem } from 'primeng/api';
import { ErpContextMenuConfig } from './erp-context-menu.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpContextMenuBuilder extends ErpBaseBuilder<ErpContextMenuConfig> {
  constructor() {
    super();
    this._data.items = [];
    this._data.global = false;
  }

  public addItem(item: MenuItem): this {
    if (!this._data.items) {
      this._data.items = [];
    }
    // Note: This only works for static arrays. If items is a signal, this will need a different approach.
    // For now, we assume the builder is used for static or initially defined arrays.
    if (Array.isArray(this._data.items)) {
      this._data.items.push(item);
    }
    return this;
  }

  public setGlobal(global: MaybeSignal<boolean | undefined>): this {
    this._data.global = global;
    return this;
  }

  public setItems(items: MaybeSignal<MenuItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }
}
