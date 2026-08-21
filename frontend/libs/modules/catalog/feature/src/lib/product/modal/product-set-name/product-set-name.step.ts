import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { BatchCommandOfProductSetNameCommandAndSearchProductRequest, CatalogProductOrchestrator } from '@erp/catalog/data-access';
import { ProductSetNameMetadata } from './product-set-name.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpBatchStepBase,
} from '@erp/shared/ui';

/**
 * Odpowiednik reguły z agregatu (`Product.ValidateName` odrzuca `IsNullOrWhiteSpace`):
 * sama spacja przechodzi przez `Validators.required`, a na backendzie wywróciłaby zadanie.
 * Zwraca ten sam klucz błędu co `required`, więc komunikat jest jeden.
 */
function nameNotBlankValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return typeof value === 'string' && value.trim().length === 0 ? { required: true } : null;
}

/**
 * Step komponent do seryjnej edycji nazwy produktów.
 *
 * Cała treść (podsumowanie zaznaczonych produktów + pole nazwy) jest deklaratywnie
 * zbudowana przez `ErpStepContentBuilder` i wyrenderowana przez jeden `<erp-step-content>`.
 * Komponent odpowiada wyłącznie za logikę: synchronizację `command.templateCommand.name` ↔
 * formularz i wstępne wypełnienie pola przy jednym zaznaczonym produkcie.
 */
@Component({
  selector: 'erp-catalog-product-set-name-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSetNameStepComponent extends ErpBatchStepBase<BatchCommandOfProductSetNameCommandAndSearchProductRequest, ProductSetNameMetadata> {
  /** Deklaratywna konfiguracja treści stepu zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;

  private readonly _orchestrator = inject(CatalogProductOrchestrator);
  private readonly _viewModels = this._orchestrator.getViewModel();

  /** Jednorazowe wypełnienie pola nazwą produktu (tylko przy jednym zaznaczeniu). */
  private _namePrefilled = false;

  protected readonly products = computed(() => {
    const viewModels = this._viewModels();
    return this.targetUuids().map((uuid) => {
      const vm = viewModels.get(uuid);
      return {
        uuid,
        sku: vm?.codeValue('SKU') ?? null,
        name: vm?.name ?? null,
      };
    });
  });

  /** Produkty zmapowane na kontrakt podsumowania (`ErpBatchTargetItem`). */
  protected readonly targetItems = computed(() =>
    this.products().map((p) => ({
      uuid: p.uuid,
      label: p.name ? (p.sku ? `${p.sku} — ` : '') + p.name : null,
    })),
  );

  public constructor() {
    const config = ErpStepContentBuilder.create(b => b
      .setLayout('stack')
      .addBatchTargetsSummary(s => s
        // Gettery, nie odczyty `this.pole` wprost — `super()` (a z nią pola bazy
        // `ErpBatchStepBase.targetCount`/`isFilterMode` i pole `targetItems` tej klasy)
        // jeszcze nie wystartował w momencie budowania tego configu.
        .setItems(() => this.targetItems())
        .setTargetCount(() => this.targetCount())
        .setIsFilterMode(() => this.isFilterMode())
        .setMessages({
          messageKey: PRODUCT_KEYS.commands.setName.editMessage,
          suffixSingleKey: PRODUCT_KEYS.commands.setName.productSuffixSingle,
          suffixPluralKey: PRODUCT_KEYS.commands.setName.productSuffixPlural,
          filterModeSuffixKey: PRODUCT_KEYS.commands.setName.filterModeSuffix,
          filterModeHintKey: PRODUCT_KEYS.commands.setName.filterModeHint,
        })
        .setEmptyKey(PRODUCT_KEYS.commands.setName.emptySelection)
        .setLoadingKey(PRODUCT_KEYS.base.loading),
      )
      .addFormField('name', 'text',
        ib => ib
          .setLabel(PRODUCT_KEYS.commands.setName.nameLabel)
          .setPlaceholder(PRODUCT_KEYS.commands.setName.namePlaceholder)
          .setHint(PRODUCT_KEYS.commands.setName.nameHint)
          .setIconStart('@tui.pencil')
          .setErrorMessages({ required: PRODUCT_KEYS.validations.nameRequired }),
        {
          validators: [Validators.required, nameNotBlankValidator],
          // Model → formularz: komenda jest jedynym źródłem prawdy dla wartości pola.
          value: () => this.command()().templateCommand?.name ?? '',
          // Formularz → model: `templateCommand` + `targetUuids` to tryb 2 kontraktu BatchCommand.
          onChange: (value) => {
            this.command().update((cmd) => ({
              ...cmd,
              templateCommand: { ...cmd.templateCommand, name: value ?? '' },
            }));
          },
        },
      )
    );

    super(config);
    this.formContent = config;

    // Tryb celów (uuidy vs filtr) i blokadę zapisu bez celów obsługuje `ErpBatchStepBase`.

    // Przy jednym zaznaczonym produkcie wygodniej edytować jego bieżącą nazwę niż pisać od zera.
    // Wartość ustawiamy na kontrolce (z emisją zdarzeń), żeby przeszła normalną ścieżką
    // Form → Model i odświeżyła stan walidacji kroku.
    effect(() => {
      if (this._namePrefilled) {
        return;
      }

      if (this.command()().templateCommand?.name) {
        this._namePrefilled = true;
        return;
      }

      const products = this.products();
      if (products.length !== 1) {
        this._namePrefilled = true;
        return;
      }

      const name = products[0].name;
      if (!name) {
        return; // produkt jeszcze się doczytuje
      }

      this._namePrefilled = true;
      config.formGroup.get('name')?.setValue(name);
    });
  }
}
