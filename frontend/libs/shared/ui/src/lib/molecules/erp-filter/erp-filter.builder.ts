import { FormGroup, FormControl, ValidatorFn } from '@angular/forms';
import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal, Translatable, unwrapSignal } from '../../base/erp-signal-utils';
import { ErpFilterConfig, ErpFilterGroup, ErpFilterFieldElement } from './erp-filter.types';
import { ErpFormFieldType } from '../../atoms/erp-step-content/erp-step-content.types';

// Import builders and components
import { ErpInputComponent } from '../../form/erp-input/erp-input.component';
import { ErpInputBuilder } from '../../form/erp-input/erp-input.builder';
import { ErpSwitchComponent } from '../../form/erp-switch/erp-switch.component';
import { ErpSwitchBuilder } from '../../form/erp-switch/erp-switch.builder';
import { ErpInputColorComponent } from '../../form/erp-input-color/erp-input-color.component';
import { ErpInputColorBuilder } from '../../form/erp-input-color/erp-input-color.builder';
import { ErpCheckboxComponent, ErpCheckboxBuilder } from '../../form/erp-checkbox';
import { ErpInputNumberComponent, ErpInputNumberBuilder } from '../../form/erp-input-number';
import { ErpInputPickerComponent, ErpInputPickerBuilder } from '../../form/erp-input-picker';

const FIELD_TYPE_COMPONENT_MAP: Record<Exclude<ErpFormFieldType, 'custom'>, Type<any>> = {
  text: ErpInputComponent,
  number: ErpInputNumberComponent,
  switch: ErpSwitchComponent,
  color: ErpInputColorComponent,
  checkbox: ErpCheckboxComponent,
  inputPicker: ErpInputPickerComponent,
} as any;

export interface ErpFilterFormFieldBuilderMap {
  text: ErpInputBuilder;
  number: ErpInputNumberBuilder;
  switch: ErpSwitchBuilder;
  color: ErpInputColorBuilder;
  checkbox: ErpCheckboxBuilder;
  inputPicker: ErpInputPickerBuilder;
}

export interface ErpFilterFormFieldValueMap {
  text: string;
  number: number | null;
  switch: boolean;
  color: string;
  checkbox: boolean;
  inputPicker: any;
}

export interface ErpFilterFormFieldOptions<TValue> {
  defaultValue?: TValue;
  validators?: ValidatorFn[];
  value?: MaybeSignal<TValue> | (() => TValue);
  onChange?: (value: TValue) => void;
  colSpan?: MaybeSignal<number>;
  styleClass?: MaybeSignal<string>;
}

const FIELD_BUILDER_CONSTRUCTORS: Record<keyof ErpFilterFormFieldBuilderMap, new () => any> = {
  text: ErpInputBuilder,
  number: ErpInputNumberBuilder,
  switch: ErpSwitchBuilder,
  color: ErpInputColorBuilder,
  checkbox: ErpCheckboxBuilder,
  inputPicker: ErpInputPickerBuilder,
} as any;

export class ErpFilterGroupBuilder extends ErpBaseBuilder<Omit<ErpFilterGroup, 'key'>> {
  private _formGroup: FormGroup;

  public constructor(formGroup: FormGroup) {
    super();
    this._formGroup = formGroup;
    this._data.fields = [];
    this._data.isExpanded = true;
  }

  public setTitle(title: MaybeSignal<Translatable>): this {
    this._data.title = title;
    return this;
  }

  public setExpanded(expanded: MaybeSignal<boolean>): this {
    this._data.isExpanded = expanded;
    return this;
  }

  public setStyleClass(styleClass: MaybeSignal<string>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  public addFormField<TType extends keyof ErpFilterFormFieldBuilderMap>(
    key: string,
    fieldType: TType,
    config:
      | ErpFilterFormFieldBuilderMap[TType]
      | ReturnType<ErpFilterFormFieldBuilderMap[TType]['build']>
      | ((builder: ErpFilterFormFieldBuilderMap[TType]) => void),
    options: ErpFilterFormFieldOptions<ErpFilterFormFieldValueMap[TType]> = {}
  ): this {
    let builderInstance: any;
    if (typeof config === 'function') {
      const BuilderConstructor = FIELD_BUILDER_CONSTRUCTORS[fieldType];
      if (!BuilderConstructor) {
        throw new Error(`Brak zdefiniowanego konstruktora buildera dla typu pola: ${fieldType}`);
      }
      builderInstance = new BuilderConstructor();
      config(builderInstance);
    } else {
      builderInstance = config;
    }

    const extractedConfig = this._extract(builderInstance);
    
    // Add to FormGroup if not exists, otherwise we might reuse the same key, but typically they are unique
    if (!this._formGroup.contains(key)) {
      this._formGroup.addControl(key, new FormControl(options.defaultValue ?? null, options.validators || []));
    }

    if (Array.isArray(this._data.fields)) {
      this._data.fields.push({
        type: 'formField',
        key,
        fieldType,
        component: FIELD_TYPE_COMPONENT_MAP[fieldType],
        config: extractedConfig,
        value: options.value,
        onChange: options.onChange,
        colSpan: options.colSpan,
        styleClass: options.styleClass,
      });
    }
    return this;
  }

  public addCustomFormField<TComp>(
    key: string,
    component: MaybeSignal<Type<TComp>>,
    config: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> },
    options: ErpFilterFormFieldOptions<any> = {}
  ): this {
    const extractedConfig = this._extract(config);
    if (!this._formGroup.contains(key)) {
      this._formGroup.addControl(key, new FormControl(options.defaultValue ?? null, options.validators || []));
    }

    if (Array.isArray(this._data.fields)) {
      this._data.fields.push({
        type: 'formField',
        key,
        fieldType: 'custom',
        component: unwrapSignal(component) as any,
        config: extractedConfig,
        value: options.value,
        onChange: options.onChange,
        colSpan: options.colSpan,
        styleClass: options.styleClass,
      });
    }
    return this;
  }
}

export class ErpFilterBuilder extends ErpBaseBuilder<ErpFilterConfig> {
  public constructor(formGroup?: FormGroup) {
    super();
    this._data.groups = [];
    this._data.formGroup = formGroup || new FormGroup({});
    this._data.autoSearch = false;
  }

  public setFilterKey(key: string): this {
    this._data.filterKey = key;
    return this;
  }

  public setAutoSearch(autoSearch: MaybeSignal<boolean>): this {
    this._data.autoSearch = autoSearch;
    return this;
  }

  public setStyleClass(styleClass: MaybeSignal<string>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  public addGroup(
    key: string,
    configure: (builder: ErpFilterGroupBuilder) => void
  ): this {
    const groupBuilder = new ErpFilterGroupBuilder(this._data.formGroup!);
    configure(groupBuilder);
    const groupData = groupBuilder.build();

    if (Array.isArray(this._data.groups)) {
      this._data.groups.push({
        key,
        ...groupData,
      });
    }
    return this;
  }
}
