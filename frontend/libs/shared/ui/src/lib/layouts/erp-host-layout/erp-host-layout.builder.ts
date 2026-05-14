import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpHostLayoutConfig } from './erp-host-layout.types';
import { ErpUserMenuConfig } from '@erp/shared/ui/erp-user-menu';
import { ErpPanelMenuConfig } from '@erp/shared/ui/erp-panel-menu';
import { ErpBreadcrumbConfig } from '@erp/shared/ui/erp-breadcrumb';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpHostLayoutBuilder extends ErpBaseBuilder<ErpHostLayoutConfig> {
  constructor() {
    super();
    this._data = {};
  }

  public setUserMenuConfig(config: MaybeSignal<ErpUserMenuConfig>): this {
    this._data.userMenuConfig = config;
    return this;
  }

  public setMenuConfig(config: MaybeSignal<ErpPanelMenuConfig>): this {
    this._data.menuConfig = config;
    return this;
  }

  public setBreadcrumbConfig(config: MaybeSignal<ErpBreadcrumbConfig>): this {
    this._data.breadcrumbConfig = config;
    return this;
  }

  public setContentComponent<T = any>(
    component: MaybeSignal<Type<T>>,
    config?: MaybeSignal<ErpComponentSignalInputs<T> | any>
  ): this {
    this._data.contentComponent = component;
    this._data.contentConfig = config;
    return this;
  }
}
