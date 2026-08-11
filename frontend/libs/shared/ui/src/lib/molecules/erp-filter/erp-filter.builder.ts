import { FormGroup, FormControl, ValidatorFn } from '@angular/forms';
import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpFieldConfigInput } from '../../base/erp-component-signal-inputs';
import { MaybeSignal, Translatable, unwrapSignal } from '../../base/erp-signal-utils';
import { ErpFilterConfig, ErpFilterGroup, ErpFilterFieldElement, ErpFilterFormFieldType } from './erp-filter.types';

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
import { ErpBulkInputComponent, ErpBulkInputBuilder } from '../../form/erp-bulk-input';

const FIELD_TYPE_COMPONENT_MAP: Record<Exclude<ErpFilterFormFieldType, 'custom'>, Type<any>> = {
  text: ErpInputComponent,
  number: ErpInputNumberComponent,
  switch: ErpSwitchComponent,
  color: ErpInputColorComponent,
  checkbox: ErpCheckboxComponent,
  inputPicker: ErpInputPickerComponent,
  bulkInput: ErpBulkInputComponent,
} as any;

export interface ErpFilterFormFieldBuilderMap {
  text: ErpInputBuilder;
  number: ErpInputNumberBuilder;
  switch: ErpSwitchBuilder;
  color: ErpInputColorBuilder;
  checkbox: ErpCheckboxBuilder;
  inputPicker: ErpInputPickerBuilder;
  bulkInput: ErpBulkInputBuilder;
}

export interface ErpFilterFormFieldValueMap {
  text: string;
  number: number | null;
  switch: boolean;
  color: string;
  checkbox: boolean;
  inputPicker: any;
  bulkInput: string[];
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
  bulkInput: ErpBulkInputBuilder,
} as any;

/**
 * Builder służący do konfiguracji pojedynczej grupy filtrów (np. sekcji rozwijanej).
 */
export class ErpFilterGroupBuilder extends ErpBaseBuilder<Omit<ErpFilterGroup, 'key'>> {
  private _formGroup: FormGroup;

  public constructor(formGroup: FormGroup) {
    super();
    this._formGroup = formGroup;
    this._data.fields = [];
    this._data.isExpanded = true;
  }

  /**
   * Ustawia tytuł grupy filtrów wyświetlany w nagłówku sekcji.
   * @param title Tytuł grupy (tekst, klucz tłumaczenia lub sygnał)
   */
  public setTitle(title: MaybeSignal<Translatable>): this {
    this._data.title = title;
    return this;
  }

  /**
   * Określa, czy grupa filtrów ma być domyślnie rozwinięta po załadowaniu.
   * @param expanded True, jeśli grupa ma być rozwinięta
   */
  public setExpanded(expanded: MaybeSignal<boolean>): this {
    this._data.isExpanded = expanded;
    return this;
  }

  /**
   * Pozwala nadać niestandardowe klasy CSS dla kontenera grupy filtrów.
   * @param styleClass Zbiór klas CSS
   */
  public setStyleClass(styleClass: MaybeSignal<string>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  /**
   * Dodaje standardowe pole formularza do grupy filtrów.
   * Obsługuje wbudowane typy takie jak 'text', 'number', 'switch', 'color', 'checkbox' itp.
   * 
   * @param key Unikalny klucz kontrolki w formularzu
   * @param fieldType Typ dodawanego pola (np. 'text', 'number')
   * @param config Konfiguracja pola dostarczona poprzez buildera
   * @param options Opcjonalne ustawienia (wartość domyślna, walidatory, klasy CSS, callback na zmianę)
   */
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

  /**
   * Dodaje niestandardowy komponent jako pole formularza wewnątrz grupy filtrów.
   * Pozwala na użycie dowolnego komponentu Angulara zgodnego ze standardem pól formularza.
   * 
   * @param key Unikalny klucz kontrolki w formularzu
   * @param component Klasa komponentu (Typ)
   * @param config Konfiguracja przekazywana do inputów niestandardowego komponentu
   * @param options Opcjonalne ustawienia formularza (wartość domyślna, walidatory itp.)
   */
  public addCustomFormField<TComp>(
    key: string,
    component: MaybeSignal<Type<TComp>>,
    config: ErpFieldConfigInput<TComp> | { build: () => ErpFieldConfigInput<TComp> },
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

/**
 * Główny builder służący do konfiguracji całego panelu filtrów.
 * Zarządza podziałem na grupy oraz zachowaniem wyszukiwania.
 */
export class ErpFilterBuilder extends ErpBaseBuilder<ErpFilterConfig> {
  public constructor(formGroup?: FormGroup) {
    super();
    this._data.groups = [];
    this._data.fields = [];
    this._data.formGroup = formGroup || new FormGroup({});
    this._data.autoSearch = false;
  }

  public override build(): ErpFilterConfig {
    const config = super.build();
    if (config.initialValues) {
      const vals = unwrapSignal(config.initialValues);
      if (vals) {
        config.formGroup.patchValue(vals);
      }
    }
    return config;
  }

  /**
   * Ustawia unikalny klucz filtra.
   * Służy m.in. do zapisywania preferencji użytkownika (stanu zwinięcia, szerokości czy ustawień layoutu).
   * @param key Klucz identyfikujący ten zbiór filtrów w systemie
   */
  public setFilterKey(key: string): this {
    this._data.filterKey = key;
    return this;
  }

  /**
   * Włącza lub wyłącza automatyczne wyszukiwanie przy każdej zmianie pola formularza.
   * Jeśli ustawione na true, zmiana dowolnego filtra natychmiast zaaplikuje filtry (bez czekania na przycisk "Szukaj").
   * @param autoSearch Flaga włączająca auto-szukanie
   */
  public setAutoSearch(autoSearch: MaybeSignal<boolean>): this {
    this._data.autoSearch = autoSearch;
    return this;
  }

  /**
   * Ustawia funkcję wywoływaną podczas wyszukiwania (zatwierdzenia formularza).
   * @param onSearch Callback przyjmujący wartości formularza
   */
  public setOnSearch(onSearch: (values: any) => void): this {
    this._data.onSearch = onSearch;
    return this;
  }

  /**
   * Ustawia flagę ładowania. Gdy włączona, przycisk wyszukiwania otrzyma stan ładowania i będzie zablokowany.
   * @param loading Sygnał lub boolean reprezentujący stan ładowania
   */
  public setLoading(loading: MaybeSignal<boolean>): this {
    this._data.isLoading = loading;
    return this;
  }

  /**
   * Pozwala nadać niestandardowe klasy CSS dla całego komponentu filtrów.
   * @param styleClass Zbiór klas CSS
   */
  public setStyleClass(styleClass: MaybeSignal<string>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  /**
   * Dodaje standardowe pole formularza bezpośrednio do panelu (bez grupy).
   */
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
    
    if (!this._data.formGroup!.contains(key)) {
      this._data.formGroup!.addControl(key, new FormControl(options.defaultValue ?? null, options.validators || []));
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

  /**
   * Dodaje niestandardowe pole formularza bezpośrednio do panelu (bez grupy).
   */
  public addCustomFormField<TComp>(
    key: string,
    component: MaybeSignal<Type<TComp>>,
    config: ErpFieldConfigInput<TComp> | { build: () => ErpFieldConfigInput<TComp> },
    options: ErpFilterFormFieldOptions<any> = {}
  ): this {
    const extractedConfig = this._extract(config);
    if (!this._data.formGroup!.contains(key)) {
      this._data.formGroup!.addControl(key, new FormControl(options.defaultValue ?? null, options.validators || []));
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

  /**
   * Dodaje nową grupę pól formularza (sekcję) do panelu filtrów.
   * @param key Unikalny klucz grupy w zbiorze filtrów
   * @param configure Funkcja przyjmująca buildera pozwalająca zdefiniować zawartość tej grupy
   */
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

  public setSavedPresets(presets: MaybeSignal<Record<string, any>>): this {
    this._data.savedPresets = presets;
    return this;
  }

  public setInitialValues(values: MaybeSignal<Record<string, any>>): this {
    this._data.initialValues = values;
    return this;
  }

  public setOnSavePreset(onSavePreset: (event: {name: string, value: any}) => void): this {
    this._data.onSavePreset = onSavePreset;
    return this;
  }

  public setOnLoadPreset(onLoadPreset: (presetName: string) => void): this {
    this._data.onLoadPreset = onLoadPreset;
    return this;
  }

  public setOnDeletePreset(onDeletePreset: (presetName: string) => void): this {
    this._data.onDeletePreset = onDeletePreset;
    return this;
  }
}
