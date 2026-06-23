import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpStepContentConfig, ErpStepContentElement } from './erp-step-content.types';
import { ErpFormBuilder } from '../erp-form/erp-form.builder';
import { ErpSplitterBuilder } from '../../atoms/erp-splitter/erp-splitter.builder';
import { ErpCardBuilder } from '../../atoms/erp-card/erp-card.builder';

/**
 * Fluent Builder do deklaratywnego budowania treści stepów modali.
 *
 * Udostępnia convenience methods dla komponentów z `@erp/shared/ui`
 * (addText, addForm, addSplitter, addCard) oraz generyczną metodę
 * `addComponent<T>()` dla komponentów biznesowych z typowanymi inputami.
 *
 * @example Prosty formularz
 * ```ts
 * const content = ErpStepContentBuilder.content(b => b
 *   .addText(KEYS.editMessage)
 *   .addForm(f => f
 *     .setGridCols(1)
 *     .addField('name', 'text', new ErpInputTextBuilder()
 *       .setPlaceholder(KEYS.namePlaceholder)
 *     , { validators: [Validators.required] })
 *   )
 * );
 * ```
 *
 * @example Złożony layout z komponentami biznesowymi
 * ```ts
 * const content = ErpStepContentBuilder.content(b => b
 *   .addSection(s => s
 *     .setLayout('row')
 *     .addComponent(ProductListComponent, { products: productsSignal })
 *     .addComponent(InvoicePreviewComponent, { invoiceId })
 *   , { title: KEYS.sectionTitle })
 * );
 * ```
 */
export class ErpStepContentBuilder extends ErpBaseBuilder<ErpStepContentConfig> {

  public constructor() {
    super();
    this._data.elements = [];
    this._data.layout = 'stack';
  }

  // ═══ Layout ═══

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

  // ═══ Shared UI convenience methods ═══

  /**
   * Dodaje blok tekstu tłumaczony przez Transloco.
   * Renderuje `<erp-text>` z podaną konfiguracją.
   *
   * @param value — Klucz tłumaczenia lub obiekt Translatable
   * @param options — Opcjonalne klasy CSS i style inline
   */
  public addText(
    value: MaybeSignal<Translatable>,
    options?: { styleClass?: MaybeSignal<string>; style?: MaybeSignal<Record<string, string>> }
  ): this {
    this._pushElement({
      type: 'text',
      config: { value },
      styleClass: options?.styleClass,
      style: options?.style,
    });
    return this;
  }

  /**
   * Dodaje formularz budowany przez ErpFormBuilder.
   * Renderuje `<erp-form>` z wynikową konfiguracją.
   *
   * @param configure — Callback konfigurujący ErpFormBuilder
   *
   * @example
   * ```ts
   * .addForm(f => f
   *   .setGridCols(2)
   *   .addField('name', 'text', { placeholder: KEYS.name })
   *   .addField('price', 'text', { placeholder: KEYS.price })
   * )
   * ```
   */
  public addForm(configure: (builder: ErpFormBuilder) => void): this {
    const builder = new ErpFormBuilder();
    configure(builder);
    this._pushElement({
      type: 'form',
      config: builder.build(),
    });
    return this;
  }

  /**
   * Dodaje splitter budowany przez ErpSplitterBuilder.
   * Renderuje `<erp-splitter>` z wynikową konfiguracją.
   *
   * @param configure — Callback konfigurujący ErpSplitterBuilder
   *
   * @example
   * ```ts
   * .addSplitter(sp => sp
   *   .setLayout('horizontal')
   *   .addPanel({ size: 40, component: ListComponent, config: { items } })
   *   .addPanel({ size: 60, component: DetailComponent, config: { id } })
   * )
   * ```
   */
  public addSplitter(configure: (builder: ErpSplitterBuilder) => void): this {
    const builder = new ErpSplitterBuilder();
    configure(builder);
    this._pushElement({
      type: 'splitter',
      config: builder.build(),
    });
    return this;
  }

  /**
   * Dodaje kartę budowaną przez ErpCardBuilder.
   * Renderuje `<erp-card>` z wynikową konfiguracją.
   *
   * @param configure — Callback konfigurujący ErpCardBuilder
   */
  public addCard(configure: (builder: ErpCardBuilder) => void): this {
    const builder = new ErpCardBuilder();
    configure(builder);
    this._pushElement({
      type: 'card',
      config: builder.build(),
    });
    return this;
  }

  /** Dodaje wizualny separator (linia pozioma). */
  public addDivider(): this {
    this._pushElement({ type: 'divider' });
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
   * @param options — Opcje layoutu: colSpan, styleClass, style
   *
   * @example
   * ```ts
   * .addComponent(ProductListComponent, {
   *   products: productsSignal,    // IDE podpowiada dostępne inputy
   *   selectionMode: 'multiple',
   * })
   * ```
   */
  public addComponent<T>(
    component: MaybeSignal<Type<T>>,
    inputs?: ErpComponentSignalInputs<T>,
    options?: {
      colSpan?: MaybeSignal<number>;
      styleClass?: MaybeSignal<string>;
      style?: MaybeSignal<Record<string, string>>;
    }
  ): this {
    this._pushElement({
      type: 'component',
      component,
      inputs: inputs as Record<string, any>,
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
   * Sekcja może mieć własny layout (stack/row/grid), tytuł, klasy CSS i gap.
   * Wewnątrz używa tego samego buildera rekurencyjnie — pozwala
   * na dowolną głębokość kompozycji.
   *
   * @param configure — Callback konfigurujący sub-builder sekcji
   * @param options — Opcje sekcji: title, layout, gridCols, gap, colSpan, styleClass, style
   *
   * @example
   * ```ts
   * .addSection(s => s
   *   .setLayout('row')
   *   .addComponent(ProductListComponent, { products })
   *   .addComponent(ProductDetailsComponent, { product: selectedProduct })
   * , { title: KEYS.sectionProducts })
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
      styleClass?: MaybeSignal<string>;
      style?: MaybeSignal<Record<string, string>>;
    }
  ): this {
    const subBuilder = new ErpStepContentBuilder();
    configure(subBuilder);
    const subConfig = subBuilder.build();

    this._pushElement({
      type: 'section',
      children: subConfig.elements,
      layout: options?.layout || subConfig.layout,
      gridCols: options?.gridCols || subConfig.gridCols,
      gap: options?.gap || subConfig.gap,
      title: options?.title,
      colSpan: options?.colSpan,
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
   * Statyczna metoda tworząca konfigurację treści stepu.
   *
   * @example
   * ```ts
   * const config = ErpStepContentBuilder.content(b => b
   *   .addText(KEYS.header)
   *   .addForm(f => f.addField('name', 'text', { placeholder: 'Nazwa' }))
   * );
   * ```
   */
  public static content(
    configure?: (builder: ErpStepContentBuilder) => void
  ): ErpStepContentConfig {
    const builder = new ErpStepContentBuilder();
    configure?.(builder);
    return builder.build();
  }
}
