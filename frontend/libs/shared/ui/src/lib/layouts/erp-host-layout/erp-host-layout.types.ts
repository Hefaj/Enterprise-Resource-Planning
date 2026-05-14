import { Type } from '@angular/core';
import { ErpUserMenuConfig } from '@erp/shared/ui/erp-user-menu';
import { ErpPanelMenuConfig } from '@erp/shared/ui/erp-panel-menu';
import { ErpBreadcrumbConfig } from '@erp/shared/ui/erp-breadcrumb';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export interface ErpHostLayoutConfig {
  userMenuConfig?: MaybeSignal<ErpUserMenuConfig>;
  menuConfig?: MaybeSignal<ErpPanelMenuConfig>;
  breadcrumbConfig?: MaybeSignal<ErpBreadcrumbConfig>;
  
  contentComponent?: MaybeSignal<Type<any>>;
  contentConfig?: MaybeSignal<ErpComponentSignalInputs<any> | any>;
}
