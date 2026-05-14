import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpPageLayoutConfig, ErpPageRegion } from './erp-page-layout.types';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpPageLayoutBuilder extends ErpBaseBuilder<ErpPageLayoutConfig> {
  constructor() {
    super();
    this._data = {};
  }

  public setMain<T = any>(
    component: MaybeSignal<Type<T>>,
    config?: MaybeSignal<ErpComponentSignalInputs<T> | any>
  ): this {
    this._data.main = { component, config };
    return this;
  }

  public setLeftSidebar<T = any>(
    component: MaybeSignal<Type<T>>,
    config?: MaybeSignal<ErpComponentSignalInputs<T> | any>
  ): this {
    this._data.leftSidebar = { component, config };
    return this;
  }
}
