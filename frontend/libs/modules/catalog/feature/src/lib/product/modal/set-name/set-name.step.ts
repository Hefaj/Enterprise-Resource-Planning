import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BatchCommandOfProductSetNameCommandAndSearchProductRequest, CatalogProductOrchestrator } from '@erp/catalog/data-access';
import { SetNameMetadata } from './set-name.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
  ErpTextComponent,
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpModalStepBase,
  ErpTextBuilder,
} from '@erp/shared/ui';

/** Customowy walidator sprawdzający, czy nazwa nie zawiera słowa "test" */
function noTestValidator(control: AbstractControl): ValidationErrors | null {
  const val = control.value || '';
  if (val.toLowerCase().includes('test')) {
    return { noTest: true };
  }
  return null;
}

/**
 * Step komponent do seryjnej edycji nazwy produktów.
 *
 * Layout formularza budowany deklaratywnie przez ErpStepContentBuilder.
 * Komponent zarządza jedynie logiką biznesową: synchronizacją command ↔ form i walidacją.
 */
@Component({
  selector: 'erp-catalog-set-name-step',
  standalone: true,
  imports: [CommonModule, ErpStepContentComponent, ErpTextComponent],
  template: `
    @let _products = products();
 
    <div class="set-name-step">
      <p class="set-name-step__message">
        <erp-text [config]="{ value: keys.commands.setName.editMessage }" />
        <strong> {{ _products.length }} </strong>
        <erp-text [config]="{ value: _products.length === 1 ? keys.commands.setName.productSuffixSingle : keys.commands.setName.productSuffixPlural }" />:
      </p>
 
      <div class="set-name-step__badges">
        @for (p of _products; track p.uuid) {
          <div class="set-name-step__badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }} ({{ p.name }})</span>
          </div>
        }
      </div>
 
      <erp-step-content [contentConfig]="formContent" />
    </div>
  `,
  styles: [`
    .set-name-step { padding: 0.25rem 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .set-name-step__badges { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .set-name-step__badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.6rem; border-radius: 1rem;
      background: var(--p-surface-100); color: var(--p-surface-700);
      font-size: 0.8rem; font-weight: 500; border: 1px solid var(--p-surface-200);
    }
    :host-context(.dark) .set-name-step__badge,
    :host-context([data-theme="dark"]) .set-name-step__badge {
      background: var(--p-surface-800); color: var(--p-surface-200); border-color: var(--p-surface-700);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetNameStepComponent extends ErpModalStepBase<BatchCommandOfProductSetNameCommandAndSearchProductRequest, SetNameMetadata> {

  /** Deklaratywna konfiguracja formularza zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;
  protected readonly keys = PRODUCT_KEYS;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);
 
  protected products = computed(() => {
    const list = this.command()()['products'] ?? [];
    const vmMap = this._orchestrator.getViewModel()();
    return list.map((p: any) => {
      const details = vmMap.get(p.uuid);
      return {
        uuid: p.uuid,
        sku: details?.codeValue('SKU') ?? '—',
        name: details?.name ?? 'Ładowanie...',
      };
    });
  });

  public constructor() {
    // ── Build form declaratively showcasing all ErpStepContentBuilder options with setGridAreas layout ──
    const config = ErpStepContentBuilder.create(b => b
      .setGridAreas({
        template: [
          'header   header',
          'divider  divider',
          'sec      sec',
          'form     card',
          'splitter splitter',
          'comp     comp'
        ],
        columns: '1fr 1fr',
        gap: '1.5rem',
      })
      
      // 1. Text element
      .addText(PRODUCT_KEYS.commands.setName.editMessage, {
        slot: 'header',
        styleClass: 'text-primary font-bold text-lg',
      })

      // 2. Divider element
      .addDivider({ slot: 'divider' })

      // 3. Form field for name
      .addSection(sectionForm => {
        sectionForm.addFormField('name', 'text',
          ib => ib
            .setLabel(PRODUCT_KEYS.commands.setName.namePlaceholder)
            .setPlaceholder(PRODUCT_KEYS.commands.setName.namePlaceholder)
            .setHint('Wpisz nową nazwę dla zaznaczonych produktów')
            .setIconStart('@tui.pencil')
            .setErrorMessages({
              required: PRODUCT_KEYS.validations.nameRequired,
              noTest: 'Nazwa nie może zawierać słowa "test"!'
            })
          ,
          {
            validators: [Validators.required, noTestValidator],
            value: () => {
              const cmd = this.command()();
              if (cmd['templateCommand'] && cmd['templateCommand'].name !== undefined) {
                return cmd['templateCommand'].name;
              }
              const productsList = this.products();
              if (productsList.length === 1) {
                const name = productsList[0].name;
                return name && name !== 'Ładowanie...' ? name : '';
              }
              return '';
            },
            onChange: (value) => {
              this.command().update((cmd) => {
                const uuids = (cmd['products'] as any[] || []).map((p: any) => p.uuid);
                return {
                  ...cmd,
                  templateCommand: {
                    name: value ?? ''
                  },
                  targetUuids: uuids
                };
              });
            }
          }
        )
      }, { slot: 'form' })

    );
    super(config);
    this.formContent = config;
  }
}
