import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MenuItem } from 'primeng/api';
import { ErpBreadcrumbConfig } from './erp-breadcrumb.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpBreadcrumbBuilder extends ErpBaseBuilder<ErpBreadcrumbConfig> {


  public setHome(home: MaybeSignal<MenuItem | undefined>): this {
    this._data.home = home;
    return this;
  }

  public setItems(items: MaybeSignal<MenuItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }
}
