import { Directive, input, effect, Signal, WritableSignal } from '@angular/core';

/**
 * Bazowa klasa dla stepów modali ERP.
 * Automatycznie obsługuje wspólne inputy oraz rejestrację stanu canGoNext.
 */
@Directive()
export abstract class ErpModalStepBase<
  TCommand = any,
  TMetadata = any
> {
  // ── Wspólne Inputy ──
  public readonly command = input.required<WritableSignal<TCommand>>();
  public readonly metadata = input.required<WritableSignal<TMetadata>>();
  public readonly registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  // ── Wymagane właściwości ──
  /** Sygnał określający, czy krok jest poprawny (można przejść dalej). */
  protected abstract readonly canGoNext: Signal<boolean>;

  protected constructor() {
    // Automatyczna rejestracja statusu walidacji w modalu nadrzędnym
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) {
        register(this.canGoNext);
      }
    });
  }
}
