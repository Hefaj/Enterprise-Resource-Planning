import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';
import { BatchCommandOfProductSetNameCommandAndSearchProductRequest, CatalogProductOrchestrator } from '@erp/catalog/data-access';
import { SetNameMetadata } from './set-name.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
  ErpTextComponent,
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpModalStepBase,
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
 * Formularz jest budowany deklaratywnie przez `ErpStepContentBuilder`; komponent
 * odpowiada wyłącznie za logikę: synchronizację `command.templateCommand.name` ↔ formularz,
 * wstępne wypełnienie pola przy jednym zaznaczonym produkcie i blokadę zapisu bez celów.
 */
@Component({
  selector: 'erp-catalog-set-name-step',
  standalone: true,
  imports: [CommonModule, TuiIcon, ErpStepContentComponent, ErpTextComponent],
  template: `
    @let _products = products();

    <div class="set-name-step">
      @if (_products.length === 0) {
        <p class="set-name-step__empty">
          <erp-text [config]="{ value: keys.commands.setName.emptySelection }" />
        </p>
      } @else {
        <p class="set-name-step__message">
          <erp-text [config]="{ value: keys.commands.setName.editMessage }" />
          <strong> {{ _products.length }} </strong>
          <erp-text [config]="{ value: _products.length === 1 ? keys.commands.setName.productSuffixSingle : keys.commands.setName.productSuffixPlural }" />:
        </p>

        <div class="set-name-step__badges">
          @for (p of _products; track p.uuid) {
            <div class="set-name-step__badge">
              <tui-icon icon="@tui.box" class="set-name-step__badge-icon" />
              @if (p.name) {
                <span>{{ p.sku ? p.sku + ' — ' : '' }}{{ p.name }}</span>
              } @else {
                <erp-text [config]="{ value: keys.base.loading }" />
              }
            </div>
          }
        </div>
      }

      <erp-step-content [contentConfig]="formContent" />
    </div>
  `,
  styles: [`
    .set-name-step { padding: 0.75rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .set-name-step__message { margin: 0; color: var(--tui-text-secondary); }
    .set-name-step__empty { margin: 0; color: var(--tui-status-warning); }
    .set-name-step__badges { display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 12rem; overflow-y: auto; }
    .set-name-step__badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.6rem; border-radius: 1rem;
      background: var(--tui-background-neutral-1); color: var(--tui-text-primary);
      font-size: 0.8rem; font-weight: 500; border: 1px solid var(--tui-border-normal);
    }
    .set-name-step__badge-icon { font-size: 0.9rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetNameStepComponent extends ErpModalStepBase<BatchCommandOfProductSetNameCommandAndSearchProductRequest, SetNameMetadata> {
  protected readonly keys = PRODUCT_KEYS;

  /** Deklaratywna konfiguracja formularza zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;

  private readonly _orchestrator = inject(CatalogProductOrchestrator);
  private readonly _viewModels = this._orchestrator.getViewModel();

  /** Cele operacji masowej — to samo pole, które poleci na API. */
  protected readonly targetUuids = computed(() => this.command()().targetUuids ?? []);

  /** Ile celów widzi walidator grupy. Zwykłe pole, bo walidator nie może czytać sygnałów. */
  private _targetCount = 0;

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

  public constructor() {
    const config = ErpStepContentBuilder.create(b => b
      .setLayout('stack')
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

    // Bez celów nie ma czego wysłać — walidator grupy blokuje przycisk zapisu
    // (backend odrzuciłby takie zadanie komunikatem „Brak komend do wykonania").
    config.formGroup.addValidators(() => (this._targetCount > 0 ? null : { noTargets: true }));
    config.formGroup.updateValueAndValidity();

    effect(() => {
      const count = this.targetUuids().length;
      if (count !== this._targetCount) {
        this._targetCount = count;
        config.formGroup.updateValueAndValidity();
      }
    });

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
