import { Type, effect, computed, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, FormControl, ValidatorFn } from '@angular/forms';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal, Translatable, unwrapSignal } from '../../base/erp-signal-utils';
import { ErpStepContentConfig, ErpStepContentElement, ErpGridAreasConfig, ErpFormFieldType } from './erp-step-content.types';
import { ErpTextComponent } from '../../atoms/erp-text/erp-text.component';
import { ErpInputComponent } from '../../form/erp-input/erp-input.component';
import { ErpSwitchComponent } from '../../form/erp-switch/erp-switch.component';

import { ErpInputBuilder } from '../../form/erp-input/erp-input.builder';
import { ErpSwitchBuilder } from '../../form/erp-switch/erp-switch.builder';
import { ErpInputColorComponent } from '../../form/erp-input-color/erp-input-color.component';
import { ErpInputColorBuilder } from '../../form/erp-input-color/erp-input-color.builder';
import { ErpCheckboxComponent, ErpCheckboxBuilder } from '../../form/erp-checkbox';
import { ErpInputNumberComponent, ErpInputNumberBuilder } from '../../form/erp-input-number';
import { ErpSelectComponent, ErpSelectBuilder } from '../../form/erp-select';

/** Mapowanie typów pól formularza na odpowiadające im komponenty atomowe UI. */
const FIELD_TYPE_COMPONENT_MAP: Record<Exclude<ErpFormFieldType, 'custom'>, Type<any>> = {
  text: ErpInputComponent,
  number: ErpInputNumberComponent,
  switch: ErpSwitchComponent,
  color: ErpInputColorComponent,
  checkbox: ErpCheckboxComponent,
  select: ErpSelectComponent,
} as any;

/** Mapowanie typów pól na odpowiadające im klasy Builderów */
export interface ErpFormFieldBuilderMap {
  text: ErpInputBuilder;
  number: ErpInputNumberBuilder;
  switch: ErpSwitchBuilder;
  color: ErpInputColorBuilder;
  checkbox: ErpCheckboxBuilder;
  select: ErpSelectBuilder<any>;
}

/** Mapowanie typów pól na typy ich wartości */
export interface ErpFormFieldValueMap {
  text: string;
  number: number | null;
  switch: boolean;
  color: string;
  checkbox: boolean;
  select: any;
}

/** Opcje dla pola formularza zawierające ustawienia layoutu oraz powiązań formularza */
export interface ErpFormFieldOptions<TValue> extends ErpElementLayoutOptions {
  /** Domyślna wartość, którą zostanie zainicjalizowana kontrolka w FormGroup. */
  defaultValue?: TValue;
  
  /** Tablica walidatorów Angulara (np. [Validators.required, Validators.min(0)]). */
  validators?: ValidatorFn[];
  
  /** Reaktywne powiązanie wartości (sygnał lub funkcja-getter) synchronizowane do formularza. */
  value?: MaybeSignal<TValue> | (() => TValue);
  
  /** Callback uruchamiany przy każdej zmianie wartości w formularzu (tylko kiedy pole jest poprawne). */
  onChange?: (value: TValue) => void;
}

/** Konstruktory builderów na potrzeby automatycznego tworzenia instancji */
const FIELD_BUILDER_CONSTRUCTORS: Record<keyof ErpFormFieldBuilderMap, new () => any> = {
  text: ErpInputBuilder,
  number: ErpInputNumberBuilder,
  switch: ErpSwitchBuilder,
  color: ErpInputColorBuilder,
  checkbox: ErpCheckboxBuilder,
  select: ErpSelectBuilder,
} as any;


/**
 * Opcje layoutu elementu (wspólne dla addComponent, addText, addForm, itp.).
 */
export interface ErpElementLayoutOptions {
  /** Rozpiętość kolumn w parent-grid (layout='grid'). */
  colSpan?: MaybeSignal<number>;
  /** Nazwa grid-area slotu (używane z setGridAreas). */
  slot?: string;
  /** Dodatkowa klasa CSS dla kontenera elementu. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla kontenera elementu. */
  style?: MaybeSignal<Record<string, string>>;
}

/**
 * Fluent Builder do deklaratywnego budowania treści stepów modali.
 *
 * Udostępnia convenience methods dla komponentów z `@erp/shared/ui`
 * (addText, addForm, addSplitter, addCard) oraz generyczną metodę
 * `addComponent<T>()` dla komponentów biznesowych z typowanymi inputami.
 *
 * Wszystkie convenience methods wewnętrznie delegują do `addComponent()`,
 * dzięki czemu `ErpStepContentComponent` nie musi znać żadnych
 * konkretnych komponentów — renderuje wszystko przez `ngComponentOutlet`.
 *
 * ## 3-poziomowy system layout
 *
 * **Poziom 1 — Predefiniowane** (90% przypadków):
 * ```ts
 * .setLayout('stack')   // flex column
 * .setLayout('row')     // flex row
 * .setLayout('grid')    // CSS grid + setGridCols(N)
 * ```
 *
 * **Poziom 2 — Grid Areas z nazwanymi slotami** (złożone layouty):
 * ```ts
 * .setGridAreas({
 *   template: ['form  preview', 'footer footer'],
 *   columns: '1fr 1fr',
 * })
 * .addForm(f => ..., { slot: 'form' })
 * .addComponent(Preview, {}, { slot: 'preview' })
 * ```
 *
 * **Poziom 3 — Escape hatch** (surowe CSS):
 * ```ts
 * .setRootStyle({ 'grid-template-columns': 'repeat(auto-fill, minmax(200px, 1fr))' })
 * ```
 */
export class ErpStepContentBuilder extends ErpBaseBuilder<ErpStepContentConfig> {

  public constructor(formGroup?: FormGroup) {
    super();
    this._data.elements = [];
    this._data.layout = 'stack';
    this._data.formGroup = formGroup || new FormGroup({});
  }

  // ═══ Layout — Poziom 1: Predefiniowane ═══

  /** Ustawia domyślny layout root kontenera: 'stack' (kolumna), 'row' (wiersz), 'grid' (CSS grid). */
  public setLayout(layout: MaybeSignal<'stack' | 'row' | 'grid'>): this {
    this._data.layout = layout;
    return this;
  }

  /** Ustawia ilość kolumn CSS Grid (używane gdy layout='grid'). */
  public setGridCols(cols: MaybeSignal<number>): this {
    this._data.gridCols = cols;
    return this;
  }

  /** Ustawia gap pomiędzy elementami (np. '1rem', '0.5rem'). */
  public setGap(gap: MaybeSignal<string>): this {
    this._data.gap = gap;
    return this;
  }

  /** Ustawia dodatkową klasę CSS dla root kontenera. */
  public setStyleClass(styleClass: MaybeSignal<string>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  // ═══ Layout — Poziom 2: Grid Areas z nazwanymi slotami ═══

  /**
   * Konfiguruje zaawansowany layout CSS Grid Areas z nazwanymi slotami.
   *
   * Elementy przypisuje się do slotów za pomocą `{ slot: 'nazwaSlotu' }`
   * w opcjach `addComponent()`, `addForm()`, `addText()`, itp.
   *
   * Automatycznie wymusza `layout: 'grid'`.
   *
   * @example
   * ```ts
   * .setGridAreas({
   *   template: [
   *     'header   header',
   *     'sidebar  main',
   *     'footer   footer',
   *   ],
   *   columns: '280px 1fr',
   *   rows: 'auto 1fr auto',
   *   gap: '1rem',
   * })
   * .addText(KEYS.title, { slot: 'header' })
   * .addComponent(Sidebar, {}, { slot: 'sidebar' })
   * .addForm(f => ..., { slot: 'main' })
   * ```
   */
  public setGridAreas(config: ErpGridAreasConfig): this {
    this._data.gridAreas = config;
    this._data.layout = 'grid';
    return this;
  }

  // ═══ Layout — Poziom 3: Escape hatch ═══

  /**
   * Ustawia surowe inline style na root kontenerze.
   *
   * Escape hatch — gdy predefiniowane layouty i Grid Areas nie wystarczą.
   * Style są mergowane na końcu, nadpisując wygenerowane.
   *
   * @example
   * ```ts
   * .setLayout('grid')
   * .setRootStyle({
   *   'grid-template-columns': 'repeat(auto-fill, minmax(200px, 1fr))',
   *   'grid-auto-rows': '150px',
   * })
   * ```
   */
  public setRootStyle(style: MaybeSignal<Record<string, string>>): this {
    this._data.rootStyle = style;
    return this;
  }

  // ═══ Shared UI convenience methods ═══

  /**
   * Dodaje blok tekstu tłumaczony przez Transloco.
   * Wewnętrznie tworzy `ErpTextComponent` renderowany przez `ngComponentOutlet`.
   *
   * @param value — Klucz tłumaczenia lub obiekt Translatable
   * @param options — Opcje layoutu: slot, colSpan, styleClass, style
   */
  public addText(
    value: MaybeSignal<Translatable>,
    options?: ErpElementLayoutOptions
  ): this {
    this.addComponent(
      ErpTextComponent,
      { config: { value } } as any,
      options
    );
    return this;
  }


  /**
   * Dodaje pojedyncze, płaskie pole formularza z wbudowanym typem (text, select, datepicker itp.).
   * Wszystkie pola dodane za pomocą tej metody współdzielą jedną centralną instancję FormGroup.
   *
   * @param key — Unikalny klucz kontrolki w FormGroup
   * @param fieldType — Typ kontrolki formularza
   * @param config — Konfiguracja specyficzna dla danej kontrolki
   * @param options — Opcje: slot, colSpan, wartość domyślna, walidatory, style
   */
  public addFormField<TType extends keyof ErpFormFieldBuilderMap>(
    key: string,
    fieldType: TType,
    config:
      | ErpFormFieldBuilderMap[TType]
      | ReturnType<ErpFormFieldBuilderMap[TType]['build']>
      | ((builder: ErpFormFieldBuilderMap[TType]) => void),
    options: ErpFormFieldOptions<ErpFormFieldValueMap[TType]> = {}
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
    this._data.formGroup!.addControl(key, new FormControl(options.defaultValue ?? null, options.validators || []));

    this._pushElement({
      type: 'formField',
      key,
      fieldType,
      component: FIELD_TYPE_COMPONENT_MAP[fieldType],
      config: extractedConfig,
      value: options.value,
      onChange: options.onChange,
      slot: options.slot,
      colSpan: options.colSpan,
      styleClass: options.styleClass,
      style: options.style,
    });
    return this;
  }

  /**
   * Dodaje pojedyncze customowe pole formularza (z własnym komponentem).
   * Wszystkie pola dodane za pomocą tej metody współdzielą jedną centralną instancję FormGroup.
   *
   * @param key — Unikalny klucz kontrolki w FormGroup
   * @param component — Klasa komponentu Angular do wyrenderowania
   * @param config — Inputy przekazywane do komponentu
   * @param options — Opcje: slot, colSpan, wartość domyślna, walidatory, style
   */
  public addCustomFormField<TComp>(
    key: string,
    component: MaybeSignal<Type<TComp>>,
    config: ErpComponentSignalInputs<TComp> | { build: () => ErpComponentSignalInputs<TComp> },
    options: ErpElementLayoutOptions & {
      defaultValue?: any;
      validators?: any[];
      value?: MaybeSignal<any> | (() => any);
      onChange?: (value: any) => void;
    } = {}
  ): this {
    const extractedConfig = this._extract(config);
    this._data.formGroup!.addControl(key, new FormControl(options.defaultValue ?? null, options.validators || []));

    this._pushElement({
      type: 'formField',
      key,
      fieldType: 'custom',
      component: unwrapSignal(component) as any,
      config: extractedConfig,
      value: options.value,
      onChange: options.onChange,
      slot: options.slot,
      colSpan: options.colSpan,
      styleClass: options.styleClass,
      style: options.style,
    });
    return this;
  }

  /** Dodaje wizualny separator (linia pozioma). */
  public addDivider(options?: { slot?: string }): this {
    this._pushElement({ type: 'divider', slot: options?.slot });
    return this;
  }

  // ═══ Generic component method ═══

  /**
   * Dodaje dowolny komponent Angular z typowanymi inputami.
   *
   * Dzięki `ErpComponentSignalInputs<T>` IDE podpowiada jakie inputy ma
   * przekazywany komponent (wyciągane z `InputSignal` i `ModelSignal`).
   *
   * Używaj tej metody do wstrzykiwania komponentów biznesowych
   * z warstwy `feature` lub `ui` modułów domenowych.
   *
   * @param component — Klasa komponentu Angular
   * @param inputs — Typowane inputy komponentu (IDE podpowiada dostępne pola)
   * @param options — Opcje layoutu: slot, colSpan, styleClass, style
   *
   * @example
   * ```ts
   * .addComponent(ProductListComponent, {
   *   products: productsSignal,    // IDE podpowiada dostępne inputy
   *   selectionMode: 'multiple',
   * }, { slot: 'sidebar' })
   * ```
   */
  public addComponent<T>(
    component: Type<T>,
    inputs?: ErpComponentSignalInputs<T>,
    options?: ErpElementLayoutOptions
  ): this {
    this._pushElement({
      type: 'component',
      component,
      inputs: inputs as Record<string, any>,
      slot: options?.slot,
      colSpan: options?.colSpan,
      styleClass: options?.styleClass,
      style: options?.style,
    });
    return this;
  }

  // ═══ Section (rekurencyjny sub-builder) ═══

  /**
   * Dodaje sekcję z zagnieżdżonymi elementami.
   *
   * Sekcja może mieć własny layout (stack/row/grid/gridAreas), tytuł, klasy CSS i gap.
   * Wewnątrz używa tego samego buildera rekurencyjnie — pozwala
   * na dowolną głębokość kompozycji.
   *
   * @param configure — Callback konfigurujący sub-builder sekcji
   * @param options — Opcje sekcji: slot, title, layout, gridCols, gap, colSpan, styleClass, style
   *
   * @example
   * ```ts
   * .addSection(s => s
   *   .setLayout('row')
   *   .addComponent(ProductListComponent, { products })
   *   .addComponent(ProductDetailsComponent, { product: selectedProduct })
   * , { slot: 'main', title: KEYS.sectionProducts })
   * ```
   */
  public addSection(
    configure: (builder: ErpStepContentBuilder) => void,
    options?: {
      title?: MaybeSignal<Translatable>;
      layout?: MaybeSignal<'stack' | 'row' | 'grid'>;
      gridCols?: MaybeSignal<number>;
      gap?: MaybeSignal<string>;
      colSpan?: MaybeSignal<number>;
      slot?: string;
      styleClass?: MaybeSignal<string>;
      style?: MaybeSignal<Record<string, string>>;
    }
  ): this {
    const subBuilder = new ErpStepContentBuilder(this._data.formGroup);
    configure(subBuilder);
    const subConfig = subBuilder.build();

    this._pushElement({
      type: 'section',
      children: subConfig.elements,
      layout: options?.layout || subConfig.layout,
      gridAreas: subConfig.gridAreas,
      gridCols: options?.gridCols || subConfig.gridCols,
      gap: options?.gap || subConfig.gap,
      title: options?.title,
      colSpan: options?.colSpan,
      slot: options?.slot,
      styleClass: options?.styleClass || subConfig.styleClass,
      style: options?.style,
    });
    return this;
  }

  // ═══ Internal ═══

  private _pushElement(element: ErpStepContentElement): void {
    if (Array.isArray(this._data.elements)) {
      this._data.elements.push(element);
    }
  }

  // ═══ Static factory ═══

  /**
   * Wyciąga FormGroup z konfiguracji treści stepu.
   *
   * Przeszukuje elementy typu 'component' i szuka tego, który
   * ma `inputs.config.formGroup` — tj. elementu wygenerowanego
   * przez `addForm()`.
   *
   * @param config — Konfiguracja treści stepu
   * @returns FormGroup lub null jeśli nie znaleziono
   *
   * @example
   * ```ts
   * const formContent = ErpStepContentBuilder.create(b => b.addForm(f => ...));
   * const formGroup = ErpStepContentBuilder.findFormGroup(formContent);
   * const nameControl = formGroup!.get('name') as FormControl<string>;
   * ```
   */
  public static findFormGroup(config: ErpStepContentConfig): import('@angular/forms').FormGroup | null {
    if (config.formGroup && Object.keys(config.formGroup.controls).length > 0) {
      return config.formGroup;
    }
    for (const element of config.elements) {
      if (element.type === 'component' && element.inputs?.['config']?.formGroup) {
        return element.inputs['config'].formGroup;
      }
    }
    return config.formGroup || null;
  }

  /**
   * Automatycznie synchronizuje wartości i stan walidacji pól formularza.
   *
   * Skanuje konfigurację i dla każdego pola ze zdefiniowanym `value` lub `onChange`:
   * 1. (Model -> Form) Tworzy effect() aktualizujący FormControl przy zmianach sygnału/funkcji `value`.
   * 2. (Form -> Model) Subskrybuje `valueChanges` i wywołuje callback `onChange` (tylko gdy pole jest prawidłowe).
   * 3. (Opcjonalnie) Rejestruje globalny stan walidacji kroku przez przekazany `registerCanGoNext`.
   *
   * @param config - Konfiguracja zbudowana przez builder
   * @param options - Opcje wiązania (np. registerCanGoNext input)
   */
  public static bindForm(
    config: ErpStepContentConfig,
    options?: { registerCanGoNext?: any }
  ): void {
    const formGroup = this.findFormGroup(config);
    if (!formGroup) {
      return;
    }

    // Rekurencyjnie przeszukaj elementy w poszukiwaniu pól formularza
    const setupBindings = (elements: ErpStepContentElement[]) => {
      for (const element of elements) {
        if (element.type === 'section') {
          setupBindings(element.children);
        } else if (element.type === 'formField') {
          const control = formGroup.get(element.key) as FormControl;
          if (!control) {
            continue;
          }

          // 1. Model -> Form sync (przy użyciu effect)
          if (element.value !== undefined) {
            const valSource = element.value;
            effect(() => {
              const val = typeof valSource === 'function' ? valSource() : unwrapSignal(valSource);
              if (control.value !== val) {
                control.setValue(val, { emitEvent: false });
              }
            });
          }

          // 2. Form -> Model sync (tylko gdy kontrolka jest prawidłowa)
          if (element.onChange) {
            const changeHandler = element.onChange;
            control.valueChanges.pipe(
              takeUntilDestroyed()
            ).subscribe((val) => {
              if (control.valid) {
                changeHandler(val);
              }
            });
          }
        }
      }
    };

    setupBindings(config.elements);

    // 3. Rejestracja canGoNext
    if (options?.registerCanGoNext) {
      effect((onCleanup) => {
        const registerFn = typeof options.registerCanGoNext === 'function'
          ? (options.registerCanGoNext as () => any)()
          : unwrapSignal(options.registerCanGoNext);
        if (typeof registerFn === 'function') {
          const validSignal = signal(formGroup.valid);
          const sub = formGroup.statusChanges.subscribe(() => {
            validSignal.set(formGroup.valid);
          });
          onCleanup(() => {
            sub.unsubscribe();
          });
          registerFn(validSignal.asReadonly());
        }
      });
    }
  }
}
