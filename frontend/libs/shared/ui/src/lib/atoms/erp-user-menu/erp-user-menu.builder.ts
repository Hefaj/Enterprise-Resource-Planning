import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MenuItem } from 'primeng/api';
import { ErpUserMenuConfig } from './erp-user-menu.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpUserMenuBuilder extends ErpBaseBuilder<ErpUserMenuConfig> {


  public setItems(items: MaybeSignal<MenuItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }

  public setUserName(name: MaybeSignal<string | undefined>): this {
    this._data.userName = name;
    return this;
  }

  public setUserRole(role: MaybeSignal<string | undefined>): this {
    this._data.userRole = role;
    return this;
  }

  public setUserImage(image: MaybeSignal<string | undefined>): this {
    this._data.userImage = image;
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
