import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpFormField, ErpFormFieldType, ErpFormConfig } from './erp-form.types';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpFormBuilder extends ErpBaseBuilder<ErpFormConfig> {
  private _controls: Record<string, FormControl> = {};

  constructor() {
    super();
    this._data.fields = [];
    this._data.gridCols = 1;
  }

  /** Ustawia ilość kolumn w siatce formularza (CSS grid). */
  public setGridCols(cols: MaybeSignal<number | undefined>): this {
    this._data.gridCols = cols;
    return this;
  }

  /**
   * Dodaje pole formularza z wbudowanym typem (text, select, datepicker, itp.).
   * @param key — Nazwa pola (klucz w FormGroup)
   * @param type — Typ atomu formularza
   * @param config — Konfiguracja komponentu atomu (lub builder)
   * @param options — Opcje: rozpiętość kolumn, wartość domyślna, walidatory
   */
  public addField(
    key: string,
    type: ErpFormFieldType,
    config: any | { build: () => any },
    options: { colSpan?: MaybeSignal<number | undefined>; defaultValue?: any; validators?: any[] } = {}
  ): this {
    const extractedConfig = this._extract(config);

    if (Array.isArray(this._data.fields)) {
      this._data.fields.push({
        key,
        type,
        config: extractedConfig,
        colSpan: options.colSpan,
      });
    }

    this._controls[key] = new FormControl(options.defaultValue ?? null, options.validators || []);

    return this;
  }

  /**
   * Dodaje pole z niestandardowym komponentem (typ 'custom').
   * @param key — Nazwa pola (klucz w FormGroup)
   * @param component — Klasa komponentu Angular
   * @param config — Inputy komponentu
   * @param options — Opcje: rozpiętość kolumn, wartość domyślna, walidatory
   */
  public addCustomField<TComp>(
    key: string,
    component: MaybeSignal<Type<TComp>>,
    config: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> },
    options: { colSpan?: MaybeSignal<number | undefined>; defaultValue?: any; validators?: any[] } = {}
  ): this {
    const extractedConfig = this._extract(config);

    if (Array.isArray(this._data.fields)) {
      this._data.fields.push({
        key,
        type: 'custom',
        config: extractedConfig,
        colSpan: options.colSpan,
        component,
      });
    }

    this._controls[key] = new FormControl(options.defaultValue ?? null, options.validators || []);

    return this;
  }

  public override build(): ErpFormConfig {
    const config = super.build();
    config.formGroup = new FormGroup(this._controls);
    return config;
  }
}
