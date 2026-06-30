import { Directive, input, effect, Signal, WritableSignal } from '@angular/core';
import { ErpStepContentBuilder } from '../erp-step-content/erp-step-content.builder';
import { ErpStepContentConfig } from '../erp-step-content/erp-step-content.types';

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

  protected constructor(formConfig?: ErpStepContentConfig) {
    if (formConfig) {
      ErpStepContentBuilder.bindForm(formConfig, {
        registerCanGoNext: this.registerCanGoNext,
      });
    }
  }
}
