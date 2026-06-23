import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BatchCommandOfProductSetNameCommand } from '@erp/catalog/data-access';
import { SetNameMetadata } from './set-name.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
  ErpTextComponent,
  ErpTranslatePipe,
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpInputTextBuilder,
  ErpToggleSwitchBuilder,
  ErpTextBuilder,
} from '@erp/shared/ui';

/**
 * Step komponent do seryjnej edycji nazwy produktów.
 *
 * Layout formularza budowany deklaratywnie przez ErpStepContentBuilder.
 * Komponent zarządza jedynie logiką biznesową: synchronizacją command ↔ form i walidacją.
 */
@Component({
  selector: 'erp-catalog-set-name-step',
  standalone: true,
  imports: [CommonModule, ErpTextComponent, ErpTranslatePipe, ErpStepContentComponent],
  template: `
    @let _products = products();

    <div class="set-name-step">
      <!-- <p class="set-name-step__message">
        <erp-text [config]="{ value: keys.commands.setName.editMessage }" />
        <strong>{{ _products.length }}</strong>
        <erp-text [config]="{ value: _products.length === 1 ? keys.commands.setName.productSuffixSingle : keys.commands.setName.productSuffixPlural }" />:
      </p>

      <div class="set-name-step__badges">
        @for (p of _products; track p.uuid) {
          <div class="set-name-step__badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }} ({{ p.name }})</span>
          </div>
        }
      </div> -->

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
export class SetNameStepComponent {
  protected readonly keys = PRODUCT_KEYS;

  public command = input.required<WritableSignal<BatchCommandOfProductSetNameCommand>>();
  public metadata = input.required<WritableSignal<SetNameMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  /** Deklaratywna konfiguracja formularza zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;

  /** Referencja do FormControl wyciągnięta z zbudowanego FormGroup. */
  private readonly _nameControl: FormControl<string | null>;

  protected products = computed<{ uuid: string; sku: string; name: string }[]>(
    () => this.command()()['products'] ?? []
  );

  protected canGoNext: Signal<boolean>;

  public constructor() {
    // ── Build form declaratively showcasing all ErpStepContentBuilder options ──
    this.formContent = ErpStepContentBuilder.content(b => b
      .setLayout('stack')
      .setGap('1.5rem')
      .setStyleClass('demo-step-content-root')
      
      // 1. Text element
      .addText(PRODUCT_KEYS.commands.setName.editMessage, {
        styleClass: 'text-primary font-bold text-lg',
      })
      
      // 2. Divider element
      .addDivider()
      
      // 3. Section element with nested elements and grid layout
      .addSection(s => s
        .setLayout('grid')
        .setGridCols(2)
        .setGap('1rem')
        .addText('shared.table.empty', { styleClass: 'text-sm text-gray-500' })
        .addText(PRODUCT_KEYS.commands.setName.productSuffixSingle, { styleClass: 'text-sm' })
      , { title: 'Sekcja demonstracyjna grid' })
      
      // 4. Form element with text field and toggle field
      .addForm(f => f
        .setGridCols(2)
        .addField('name', 'text',
          ErpInputTextBuilder.create(ib => ib
            .setPlaceholder(PRODUCT_KEYS.commands.setName.namePlaceholder)
            .setErrorMessages({ required: PRODUCT_KEYS.validations.nameRequired })
          ),
          { validators: [Validators.required] }
        )
        .addField('isActive', 'toggle',
          ErpToggleSwitchBuilder.create(tb => tb
            .setPlaceholder('Aktywny')
            .setHint('Zaznacz aby aktywować')
          ),
          { defaultValue: true }
        )
      )

      // 5. Card element
      .addCard(c => c
        .setTitle('Karta demonstracyjna')
        .setSubtitle('Podtytuł karty')
        .setContentComponent(ErpTextComponent, {
          config: ErpTextBuilder.create(tb => tb
            .setValue('To jest treść karty wstrzyknięta jako komponent')
          )
        })
      )

      // 6. Splitter element
      .addSplitter(sp => sp
        .setLayout('horizontal')
        .addPanel({
          size: 50,
          component: ErpTextComponent,
          config: {
            config: ErpTextBuilder.create(tb => tb
              .setValue('Lewy panel splittera')
            )
          },
        })
        .addPanel({
          size: 50,
          component: ErpTextComponent,
          config: {
            config: ErpTextBuilder.create(tb => tb
              .setValue('Prawy panel splittera')
            )
          },
        })
      )

      // 7. Component element directly
      .addComponent(ErpTextComponent, {
        config: ErpTextBuilder.create(tb => tb
          .setValue('Komponent wstrzyknięty bezpośrednio przez addComponent')
          .setTag('p')
          .setClass('text-muted italic')
        )
      })
    );

    // Extract FormGroup reference from built config for command sync
    const formElement = this.formContent.elements.find(e => e.type === 'form');
    this._nameControl = formElement!.config.formGroup.get('name') as FormControl<string | null>;

    this.canGoNext = computed(() => this._nameControl.valid);

    // ── Register canGoNext ──
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    // ── Command → Form sync ──
    effect(() => {
      const cmd = this.command()();
      if (cmd['name'] !== undefined && this._nameControl.value !== cmd['name']) {
        this._nameControl.setValue(cmd['name'], { emitEvent: false });
      }
    });

    // ── Form → Command sync ──
    this._nameControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => {
        const commands = (cmd['products'] as { uuid: string; sku: string; name: string }[] || []).map(p => ({
          uuid: p.uuid,
          name: value ?? '',
        }));
        return {
          ...cmd,
          name: value,
          commands,
        };
      });
    });
  }
}
