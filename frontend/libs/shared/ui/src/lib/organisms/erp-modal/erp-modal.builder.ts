import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpModalConfig, ErpModalSize, ErpModalStep } from './erp-modal.types';

/**
 * Fluent Builder do konfiguracji ErpModal.
 *
 * @example
 * ```ts
 * const config = ErpModalBuilder.create<EditProductCommand>(b => b
 *   .setTitle('Edycja produktu')
 *   .setCommand({ name: '', price: 0 })
 *   .addStep('Nazwa', EditProductNameStepComponent)
 *   .addStep('Cena', EditProductPriceStepComponent)
 *   .setSaveLabel('Zatwierdź')
 *   .setOnSave(async (cmd) => await this.productService.update(cmd))
 * );
 * ```
 */
export class ErpModalBuilder<TCommand = any> extends ErpBaseBuilder<ErpModalConfig<TCommand>> {

  constructor() {
    super();
    this._data.steps = [];
    this._data.showFooter = true;
  }

  /** Ustawia tytuł nagłówka modalu. */
  public setTitle(title: MaybeSignal<string>): this {
    this._data.title = title;
    return this;
  }

  /** Ustawia początkowy stan commanda. Opcjonalny dla modali frontend-only. */
  public setCommand(command: TCommand): this {
    this._data.command = command;
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
    label: MaybeSignal<string>,
    component: Type<TComp>,
    inputs?: Record<string, any>
  ): this {
    const step: ErpModalStep<TCommand> = {
      label,
      component,
      inputs,
    };
    (this._data.steps as ErpModalStep<TCommand>[]).push(step);
    return this;
  }

  /** Nadpisuje etykietę przycisku "Zapisz". */
  public setSaveLabel(label: MaybeSignal<string>): this {
    this._data.saveLabel = label;
    return this;
  }

  /** Nadpisuje etykietę przycisku "Anuluj". */
  public setCancelLabel(label: MaybeSignal<string>): this {
    this._data.cancelLabel = label;
    return this;
  }

  /** Nadpisuje etykietę przycisku "Dalej". */
  public setNextLabel(label: MaybeSignal<string>): this {
    this._data.nextLabel = label;
    return this;
  }

  /** Nadpisuje etykietę przycisku "Wstecz". */
  public setBackLabel(label: MaybeSignal<string>): this {
    this._data.backLabel = label;
    return this;
  }

  /** Ustawia callback wywoływany po kliknięciu Zapisz. Może być async. */
  public setOnSave(callback: (command: TCommand) => void | Promise<void>): this {
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

  /**
   * Statyczna metoda tworząca konfigurację modalu z generycznym TCommand.
   * @example
   * ```ts
   * const config = ErpModalBuilder.modal<EditProductCommand>(b => b
   *   .setTitle('Edycja produktu')
   *   .setCommand({ name: '' })
   *   .addStep('Dane', EditProductStepComponent)
   *   .setOnSave(async (cmd) => await api.save(cmd))
   * );
   * ```
   */
  public static modal<TCommand = any>(
    configure?: (builder: ErpModalBuilder<TCommand>) => void
  ): ErpModalConfig<TCommand> {
    const builder = new ErpModalBuilder<TCommand>();
    configure?.(builder);
    return builder.build();
  }
}
