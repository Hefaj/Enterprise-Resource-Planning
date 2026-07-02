import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpBreadcrumbConfig, ErpBreadcrumbItem } from './erp-breadcrumb.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpBreadcrumbBuilder extends ErpBaseBuilder<ErpBreadcrumbConfig> {
  public setHome(home: MaybeSignal<ErpBreadcrumbItem | undefined>): this {
    this._data.home = home;
    return this;
  }

  public setItems(items: MaybeSignal<ErpBreadcrumbItem[] | undefined>): this {
    this._data.items = items;
    return this;
  }
}
