import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpHostLayoutConfig } from './erp-host-layout.types';
import { ErpUserMenuConfig } from '../../atoms/erp-user-menu';
import { ErpPanelMenuConfig } from '../../atoms/erp-panel-menu';
import { ErpBreadcrumbConfig } from '../../atoms/erp-breadcrumb';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpHostLayoutBuilder extends ErpBaseBuilder<ErpHostLayoutConfig> {
  public constructor() {
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

  public setCloseMenuOnNavigation(close: MaybeSignal<boolean>): this {
    this._data.closeMenuOnNavigation = close;
    return this;
  }
}
