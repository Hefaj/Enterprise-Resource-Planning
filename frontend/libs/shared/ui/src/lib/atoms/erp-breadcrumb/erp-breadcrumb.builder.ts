import { ErpBaseBuilder } from '../../_base/erp-base-builder';
import { ErpBreadcrumb } from './erp-breadcrumb.component';

export class ErpBreadcrumbBuilder extends ErpBaseBuilder<ErpBreadcrumb> {
  public setRootItem(): this {
    return this;
  }
}
