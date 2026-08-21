import { Directive, computed, effect } from '@angular/core';
import { ErpModalStepBase } from './erp-modal-step.base';
import { ErpStepContentConfig } from '../erp-step-content/erp-step-content.types';
import { ErpBatchMetadata, ErpBatchTargets } from '../erp-table/erp-selection.utils';

/**
 * Baza kroku modalu operacji masowej (`BatchCommand<TCommand, TFilter>`).
 *
 * Zdejmuje z każdego modalu to, co przy celach operacji jest zawsze takie samo:
 * rozpoznanie trybu (jawne identyfikatory vs filtr), liczbę celów do pokazania
 * użytkownikowi i blokadę zapisu, gdy nie ma czego wysłać — backend odrzuciłby
 * takie zadanie komunikatem „Brak komend do wykonania".
 *
 * Krok potomny dopisuje już tylko własne pola szablonu (`templateCommand`).
 *
 * ```ts
 * export class ProductSetNameStepComponent extends ErpBatchStepBase<BatchCommandOfProductSetNameCommandAndSearchProductRequest> {
 *   public constructor() {
 *     const config = ErpStepContentBuilder.create(b => b.addFormField('name', 'text', ...));
 *     super(config);
 *   }
 * }
 * ```
 */
@Directive()
export abstract class ErpBatchStepBase<
  TCommand extends ErpBatchTargets<any>,
  TMetadata extends ErpBatchMetadata = ErpBatchMetadata
> extends ErpModalStepBase<TCommand, TMetadata> {
  /** Cele operacji masowej — to samo pole, które poleci na API. */
  protected readonly targetUuids = computed(() => this.command()().targetUuids ?? []);

  /**
   * Tryb „Zaznacz wszystko": komenda niesie filtr zamiast identyfikatorów, więc frontend
   * nie zna (i nie musi znać) konkretnych pozycji — zbiór celów wyznaczy backend.
   */
  protected readonly isFilterMode = computed(
    () => this.targetUuids().length === 0 && !!this.command()().targetFilter,
  );

  /**
   * Ile pozycji obejmie operacja. W trybie filtra liczba pochodzi z metadanych
   * (licznik wyników tabeli), bo komenda nie niesie identyfikatorów.
   */
  protected readonly targetCount = computed(() =>
    this.isFilterMode() ? this.metadata()()?.targetCount ?? 0 : this.targetUuids().length,
  );

  protected constructor(formConfig?: ErpStepContentConfig) {
    super(formConfig);

    if (!formConfig) {
      return;
    }

    // Bez celów nie ma czego wysłać. W trybie filtra wystarczy, że filtr jest —
    // pustego wyniku frontend i tak nie policzy, odrzuci go backend.
    let hasTargets = false;
    formConfig.formGroup.addValidators(() => (hasTargets ? null : { noTargets: true }));
    formConfig.formGroup.updateValueAndValidity();

    effect(() => {
      const next = this.isFilterMode() || this.targetUuids().length > 0;
      if (next !== hasTargets) {
        hasTargets = next;
        formConfig.formGroup.updateValueAndValidity();
      }
    });
  }
}
