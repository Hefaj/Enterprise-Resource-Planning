import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpFormConfig, ErpFormField, ErpFormFieldType } from './erp-form.component';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpFormBuilder extends ErpBaseBuilder<ErpFormConfig> {
  private _controls: Record<string, FormControl> = {};

  constructor() {
    super();
    this._data.fields = [];
    this._data.gridCols = 1;
  }

  public setGridCols(cols: number): this {
    this._data.gridCols = cols;
    return this;
  }

  public addField(
    key: string, 
    type: ErpFormFieldType, 
    config: any | { build: () => any }, 
    options: { colSpan?: number, defaultValue?: any, validators?: any[] } = {}
  ): this {
    const extractedConfig = this._extract(config);
    
    this._data.fields?.push({
      key,
      type,
      config: extractedConfig,
      colSpan: options.colSpan
    });

    this._controls[key] = new FormControl(options.defaultValue ?? null, options.validators || []);
    
    return this;
  }

  public addCustomField<TComp>(
    key: string,
    component: Type<TComp>,
    config: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> },
    options: { colSpan?: number, defaultValue?: any, validators?: any[] } = {}
  ): this {
    const extractedConfig = this._extract(config);
    
    this._data.fields?.push({
      key,
      type: 'custom',
      config: extractedConfig,
      colSpan: options.colSpan,
      component
    });

    this._controls[key] = new FormControl(options.defaultValue ?? null, options.validators || []);
    
    return this;
  }

  public override build(): ErpFormConfig {
    const config = super.build();
    config.formGroup = new FormGroup(this._controls);
    return config;
  }
}
