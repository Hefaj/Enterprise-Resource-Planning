import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpBreadcrumbConfig, ErpBreadcrumbItem } from './erp-breadcrumb.types';

export class ErpBreadcrumbBuilder extends ErpBaseBuilder<ErpBreadcrumbConfig> {
  public setItems(items: MaybeSignal<ErpBreadcrumbItem[]>): this {
    this._data.items = items;
    return this;
  }
}
