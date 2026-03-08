import { EBaseBuilder } from '../../_base/e-base-builder';
import { EBreadcrumb } from './e-breadcrumb.component';

export class EBreadcrumbBuilder extends EBaseBuilder<EBreadcrumb> {
  public setRootItem(): this {
    return this;
  }
}
