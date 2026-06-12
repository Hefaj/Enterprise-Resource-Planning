import { Type, Signal, WritableSignal } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';

/**
 * Konfiguracja pojedynczego kroku modalu.
 * Każdy step to oddzielny Angular component renderowany przez ngComponentOutlet.
 */
export interface ErpModalStep<TCommand = any, TMetadata = any> {
  /** Etykieta wyświetlana w stepperze. */
  label: MaybeSignal<string>;
  /** Komponent Angular renderowany w tym kroku. */
  component: Type<any>;
  /** Dodatkowe inputy przekazywane do komponentu (oprócz command, metadata i registerCanGoNext). */
  inputs?: Record<string, any>;
}

/**
 * Rozmiar modalu (szerokość).
 */
export type ErpModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Główna konfiguracja modalu.
 * @template TCommand Typ commanda (obiektu danych) edytowanego przez stepy.
 */
export interface ErpModalConfig<TCommand = any, TMetadata = any> {
  /** Tytuł wyświetlany w nagłówku modalu (jako pojedyncza nazwa lub chlebki/breadcrumb). */
  title: MaybeSignal<string | string[]>;
  /** Lista kroków modalu (min. 1). */
  steps: ErpModalStep<TCommand, TMetadata>[];
  /** Początkowy stan commanda — opcjonalny dla modali frontend-only. */
  command?: TCommand;
  /** Dodatkowe opcjonalne metadane przekazywane do kroków. */
  metadata?: TMetadata;
  /** Rozmiar modalu. Domyślnie 'md'. */
  size?: MaybeSignal<ErpModalSize>;

  // ── Customizacja etykiet przycisków ──
  /** Etykieta przycisku zapisz. Domyślnie "Zapisz". */
  saveLabel?: MaybeSignal<string>;
  /** Etykieta przycisku anuluj. Domyślnie "Anuluj". */
  cancelLabel?: MaybeSignal<string>;
  /** Etykieta przycisku dalej. Domyślnie "Dalej". */
  nextLabel?: MaybeSignal<string>;
  /** Etykieta przycisku wstecz. Domyślnie "Wstecz". */
  backLabel?: MaybeSignal<string>;

  // ── Callbacki ──
  /** Callback wywoływany po kliknięciu Zapisz. Może być async — modal pokaże loading. */
  onSave?: (command: TCommand, metadata?: TMetadata) => void | Promise<void>;
  /** Callback wywoływany po zamknięciu modalu (X lub Anuluj). */
  onCancel?: () => void;

  /** Czy wyświetlić footer z przyciskami akcji. Domyślnie true. */
  showFooter?: boolean;
}

/**
 * Referencja do otwartego modalu zwracana przez ErpModalService.
 * Pozwala programistycznie zamknąć modal i odczytać stan commanda.
 */
export interface ErpModalRef<TCommand = any, TMetadata = any> {
  /** Zamyka modal programistycznie. */
  close: () => void;
  /** WritableSignal z aktualnym stanem commanda. */
  command: WritableSignal<TCommand>;
  /** WritableSignal z aktualnym stanem metadanych. */
  metadata: WritableSignal<TMetadata>;
}

/**
 * Definicja modalu do rejestracji w globalnym rejestrze.
 *
 * Opisuje jak zbudować konfigurację modalu na podstawie commanda.
 * Rejestrowana raz, otwierana wielokrotnie z różnymi commandami.
 *
 * @template TCommand Typ commanda (obiektu danych), taki sam jak idzie na API.
 *
 * @example
 * ```ts
 * export const EDIT_SKU_MODAL: ErpModalDefinition<EditSkuCommand> = {
 *   id: 'catalog.product.edit-sku',
 *   build: (command) => ErpModalBuilder.modal<EditSkuCommand>(b => b
 *     .setTitle('Edycja kodu SKU')
 *     .setCommand(command)
 *     .addStep('Kod SKU', EditSkuStepComponent)
 *     .setSaveLabel('Zapisz SKU')
 *     .setOnSave(async (cmd) => { ... })
 *   ),
 * };
 * ```
 */
export interface ErpModalDefinition<TCommand = any, TMetadata = any> {
  /** Unikalny identyfikator modalu (np. 'catalog.product.edit-sku'). */
  id: string;
  /** Funkcja budująca ErpModalConfig na podstawie commanda i metadanych. */
  build: (command: TCommand, metadata?: TMetadata) => ErpModalConfig<TCommand, TMetadata>;
}
