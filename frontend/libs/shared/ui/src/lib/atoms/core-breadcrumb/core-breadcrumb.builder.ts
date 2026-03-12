import { CoreBaseBuilder } from '../../_base/core-base-builder';
import { CoreBreadcrumb } from './core-breadcrumb.component';

export class CoreBreadcrumbBuilder extends CoreBaseBuilder<CoreBreadcrumb> {
  public setRootItem(): this {
    return this;
  }
}
