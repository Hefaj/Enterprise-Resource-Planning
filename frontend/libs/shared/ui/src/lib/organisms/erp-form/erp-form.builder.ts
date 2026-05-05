import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpFormConfig, ErpFormField, ErpFormFieldType } from './erp-form.component';

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

  /**
   * Zwraca gotową instancję FormGroup na podstawie zdefiniowanych pól.
   */
  public buildFormGroup(): FormGroup {
    return new FormGroup(this._controls);
  }
}
