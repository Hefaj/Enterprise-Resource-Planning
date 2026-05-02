import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpDynamicFilterConfig, ErpDynamicFilterItem } from './erp-dynamic-filter.types';

export class ErpDynamicFilterBuilder extends ErpBaseBuilder<ErpDynamicFilterConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  public addFilter<T>(
    label: string | undefined,
    component: Type<T>,
    inputs: ErpComponentSignalInputs<T>
  ): this {
    this._data.items?.push({ label, component, inputs } as ErpDynamicFilterItem);
    return this;
  }

  public setSubmitButtonLabel(label: string): this {
    this._data.submitButtonLabel = label;
    return this;
  }

  public setShowSubmitButton(show: boolean): this {
    this._data.showSubmitButton = show;
    return this;
  }
}
