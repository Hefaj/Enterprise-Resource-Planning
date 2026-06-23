import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpModalConfig, ErpModalSize, ErpModalStep } from './erp-modal.types';
import { ErpStepContentBuilder } from '../erp-step-content/erp-step-content.builder';
import { ErpStepContentComponent } from '../erp-step-content/erp-step-content.component';

/**
 * Fluent Builder do konfiguracji ErpModal.
 *
 * @example
 * ```ts
 * const config = ErpModalBuilder.modal<EditProductCommand, EditProductMetadata>(b => b
 *   .setTitle('Edycja produktu')
 *   .setCommand({ name: '', price: 0 })
 *   .setMetadata({ categoryId: '123' })
 *   .addStep('Nazwa', EditProductNameStepComponent)
 *   .addStep('Cena', EditProductPriceStepComponent)
 *   .setSaveLabel('Zatwierdź')
 *   .setOnSave(async (cmd, meta) => await this.productService.update(cmd, meta))
 * );
 * ```
 */
export class ErpModalBuilder<TCommand = any, TMetadata = any> extends ErpBaseBuilder<ErpModalConfig<TCommand, TMetadata>> {

  constructor() {
    super();
    this._data.steps = [];
    this._data.showFooter = true;
  }

  /** Ustawia tytuł nagłówka modalu (jako pojedynczy ciąg lub tablicę breadcrumbów). */
  public setTitle(title: MaybeSignal<Translatable | Translatable[]>): this {
    this._data.title = title;
    return this;
  }

  /** Ustawia początkowy stan commanda. Opcjonalny dla modali frontend-only. */
  public setCommand(command: TCommand): this {
    this._data.command = command;
    return this;
  }

  /** Ustawia początkowy stan metadanych. */
  public setMetadata(metadata?: TMetadata): this {
    this._data.metadata = metadata;
    return this;
  }

  /** Ustawia rozmiar modalu. Domyślnie 'md'. */
  public setSize(size: MaybeSignal<ErpModalSize>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Dodaje krok do modalu.
   * @param label Etykieta wyświetlana w stepperze
   * @param component Komponent Angular renderowany w kroku
   * @param inputs Dodatkowe inputy przekazywane do komponentu (oprócz command i registerCanGoNext)
   */
  public addStep<TComp = any>(
    label: MaybeSignal<Translatable>,
    component: Type<TComp>,
    inputs?: Record<string, any>
  ): this {
    const step: ErpModalStep<TCommand, TMetadata> = {
      label,
      component,
      inputs,
    };
    (this._data.steps as ErpModalStep<TCommand, TMetadata>[]).push(step);
    return this;
  }

  /**
   * Dodaje krok z deklaratywną treścią budowaną przez ErpStepContentBuilder.
   *
   * Zamiast tworzyć osobny komponent Angular dla stepu, budujesz
   * treść deklaratywnie za pomocą convenience methods i addComponent.
   *
   * @param label Etykieta wyświetlana w stepperze
   * @param configure Callback konfigurujący ErpStepContentBuilder
   *
   * @example
   * ```ts
   * .addContentStep(KEYS.stepLabel, s => s
   *   .addText(KEYS.description)
   *   .addForm(f => f
   *     .addField('name', 'text', { placeholder: KEYS.name })
   *   )
   *   .addComponent(ProductListComponent, { products })
   * )
   * ```
   */
  public addContentStep(
    label: MaybeSignal<Translatable>,
    configure: (builder: ErpStepContentBuilder) => void
  ): this {
    const contentConfig = ErpStepContentBuilder.content(configure);
    const step: ErpModalStep<TCommand, TMetadata> = {
      label,
      component: ErpStepContentComponent,
      inputs: { contentConfig },
      content: contentConfig,
    };
    (this._data.steps as ErpModalStep<TCommand, TMetadata>[]).push(step);
    return this;
  }

  /** Nadpisuje etykietę przycisku "Zapisz". */
  public setSaveLabel(label: MaybeSignal<Translatable>): this {
    this._data.saveLabel = label;
    return this;
  }

  /** Nadpisuje etykietę przycisku "Anuluj". */
  public setCancelLabel(label: MaybeSignal<Translatable>): this {
    this._data.cancelLabel = label;
    return this;
  }

  /** Nadpisuje etykietę przycisku "Dalej". */
  public setNextLabel(label: MaybeSignal<Translatable>): this {
    this._data.nextLabel = label;
    return this;
  }

  /** Nadpisuje etykietę przycisku "Wstecz". */
  public setBackLabel(label: MaybeSignal<Translatable>): this {
    this._data.backLabel = label;
    return this;
  }

  /** Ustawia callback wywoływany po kliknięciu Zapisz. Może być async. */
  public setOnSave(callback: (command: TCommand, metadata?: TMetadata) => void | Promise<void>): this {
    this._data.onSave = callback;
    return this;
  }

  /** Ustawia callback wywoływany po zamknięciu modalu. */
  public setOnCancel(callback: () => void): this {
    this._data.onCancel = callback;
    return this;
  }

  /** Ukrywa footer z przyciskami (przydatne dla modali frontend-only, np. galeria). */
  public setShowFooter(show: boolean): this {
    this._data.showFooter = show;
    return this;
  }

  /** Ustawia opcjonalne providery DI (np. do dostarczenia lokalnych tłumaczeń). */
  public setProviders(providers: any[]): this {
    this._data.providers = providers;
    return this;
  }

  /**
   * Statyczna metoda tworząca konfigurację modalu z generycznym TCommand.
   * @example
   * ```ts
   * const config = ErpModalBuilder.modal<EditProductCommand, EditProductMetadata>(b => b
   *   .setTitle(['Edycja produktu'])
   *   .setCommand({ name: '' })
   *   .setMetadata({ categoryId: 'abc' })
   *   .addStep('Dane', EditProductStepComponent)
   *   .setOnSave(async (cmd, meta) => await api.save(cmd, meta))
   * );
   * ```
   */
  public static modal<TCommand = any, TMetadata = any>(
    configure?: (builder: ErpModalBuilder<TCommand, TMetadata>) => void
  ): ErpModalConfig<TCommand, TMetadata> {
    const builder = new ErpModalBuilder<TCommand, TMetadata>();
    configure?.(builder);
    return builder.build();
  }
}
