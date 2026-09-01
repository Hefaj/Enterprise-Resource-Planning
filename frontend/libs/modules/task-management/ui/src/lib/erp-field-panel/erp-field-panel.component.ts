import { ChangeDetectionStrategy, Component, computed, effect, input, output, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
  ErpUserAvatarComponent,
  unwrapSignal,
} from '@erp/shared/ui';

import { ErpFieldPanelConfig } from './erp-field-panel.types';
import { TASKMANAGEMENT_KEYS } from '../translation';

/**
 * Prawy panel pól karty zgłoszenia — stan i przejścia na górze, potem typ i metadane
 * (`docs/frontend/task-management-pages.md` §9.1, decyzja 1: „panel pól jest po prawej
 * i to on trzyma stan").
 */
@Component({
  selector: 'erp-field-panel',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputPickerComponent, ErpTranslatePipe, ErpUserAvatarComponent, ReactiveFormsModule],
  template: `
    <aside class="erp-field-panel">
      <section class="erp-field-panel__section">
        <span class="erp-field-panel__label">{{ TASKMANAGEMENT_KEYS.fieldPanel.state | erpTranslate }}</span>
        <span class="erp-field-panel__state">
          @if (this.stateTone(); as tone) {
            <span class="erp-field-panel__dot" [style.background]="tone"></span>
          }
          {{ this.stateLabel() }}
        </span>

        @if (this.transitionsEnabled()) {
          @if (this.transitions().length === 0) {
            <span class="erp-field-panel__hint">
              {{ TASKMANAGEMENT_KEYS.fieldPanel.noTransitions | erpTranslate }}
            </span>
          } @else {
            <div class="erp-field-panel__transitions">
              @for (transition of this.transitions(); track transition.id) {
                <erp-button [config]="this.transitionButton(transition.id, transition.labelKey)" />
              }
            </div>
          }
        }
      </section>

      @if (this.typeOptions(); as options) {
        <section class="erp-field-panel__section">
          <erp-input-picker
            [config]="this.typePickerConfig(options)"
            [control]="this.typeControl"
          />
        </section>
      }

      <section class="erp-field-panel__section">
        @for (row of this.rows(); track row.labelKey) {
          <div class="erp-field-panel__row">
            <span class="erp-field-panel__label">{{ row.labelKey | erpTranslate }}</span>
            <span class="erp-field-panel__value">
              @if (row.avatarUuid) {
                <erp-user-avatar size="s" [uuid]="row.avatarUuid" />
              } @else if (row.tone) {
                <span class="erp-field-panel__dot" [style.background]="row.tone"></span>
              }
              {{ row.value }}
            </span>
          </div>
        }
      </section>

      <ng-content />
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .erp-field-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .erp-field-panel__section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--tui-border-normal);
      }

      .erp-field-panel__section:last-child {
        border-bottom: none;
      }

      .erp-field-panel__label {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--tui-text-secondary);
      }

      .erp-field-panel__state {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-weight: 500;
      }

      .erp-field-panel__dot {
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .erp-field-panel__transitions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .erp-field-panel__hint {
        font-size: 0.875rem;
        color: var(--tui-text-secondary);
      }

      .erp-field-panel__row {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }

      .erp-field-panel__value {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.875rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpFieldPanelComponent {
  protected readonly TASKMANAGEMENT_KEYS = TASKMANAGEMENT_KEYS;

  public readonly config = input.required<ErpFieldPanelConfig>();

  /** Kliknięcie przycisku przejścia — `transition.id` (uuid przejścia albo `toStateUuid`,
   * zależnie od tego, co poda wywołujący). */
  public readonly transitionClick = output<string>();

  /** Nowy `typeUuid` wybrany w panelu — pusty, dopóki `typeOptions` nie jest podane. */
  public readonly typeChange = output<string>();

  protected readonly stateLabel = computed(() => unwrapSignal(this.config().stateLabel));
  protected readonly stateTone = computed(() => unwrapSignal(this.config().stateTone));
  protected readonly transitions = computed(() => unwrapSignal(this.config().transitions) ?? []);
  protected readonly transitionsEnabled = computed(() => unwrapSignal(this.config().transitionsEnabled) ?? true);
  protected readonly typeOptions = computed(() => unwrapSignal(this.config().typeOptions));
  protected readonly typeEditable = computed(() => unwrapSignal(this.config().typeEditable) ?? true);
  protected readonly rows = computed(() => unwrapSignal(this.config().rows) ?? []);

  protected readonly typeControl = new FormControl<string | null>(null);

  public constructor() {
    effect(() => {
      const value = unwrapSignal(this.config().typeValue);
      untracked(() => this.typeControl.setValue(value ?? null, { emitEvent: false }));
    });

    effect(() => {
      untracked(() => {
        if (this.typeEditable()) {
          this.typeControl.enable({ emitEvent: false });
        } else {
          this.typeControl.disable({ emitEvent: false });
        }
      });
    });

    this.typeControl.valueChanges.subscribe((value) => {
      if (value) {
        this.typeChange.emit(value);
      }
    });
  }

  protected typePickerConfig(options: readonly { value: string; label: string }[]): ErpInputPickerConfig {
    return ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(TASKMANAGEMENT_KEYS.fieldPanel.type)
        .setItems(options)
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  }

  protected transitionButton(id: string, labelKey: string): ErpButtonConfig {
    return {
      label: labelKey,
      appearance: 'secondary',
      size: 's',
      fn: (): void => this.transitionClick.emit(id),
    };
  }
}
