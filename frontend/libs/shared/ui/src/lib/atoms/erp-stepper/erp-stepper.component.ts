import { ChangeDetectionStrategy, Component, computed, input, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperModule } from 'primeng/stepper';
import { ErpStepperConfig } from './erp-stepper.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-stepper',
  standalone: true,
  imports: [CommonModule, StepperModule],
  template: `
    @let _value = activeValue();
    @let _items = unwrappedItems();
    @let _linear = linear();

    <div class="erp-stepper-container">
      @if (_items.length > 0) {
        <p-stepper [value]="_value" [linear]="_linear" (valueChange)="handleValueChange($event)">
          <p-step-list>
            @for (item of _items; track item.value) {
              <p-step [value]="item.value" [disabled]="item.disabled ?? false">
                {{ item.label }}
              </p-step>
            }
          </p-step-list>

          <p-step-panels>
            @for (item of _items; track item.value) {
              <p-step-panel [value]="item.value">
                <ng-template #content>
                  @if (item.value === _value && item.component) {
                    <div class="step-content-animate">
                      <ng-container *ngComponentOutlet="item.component; inputs: item.config" />
                    </div>
                  }
                </ng-template>
              </p-step-panel>
            }
          </p-step-panels>
        </p-stepper>
      } @else {
        <div class="erp-stepper-empty">
          <i class="pi pi-inbox"></i>
          <span>Brak kroków do wyświetlenia</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .erp-stepper-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .step-content-animate {
      animation: stepFadeIn 0.25s cubic-bezier(0, 0, 0.2, 1) forwards;
    }

    @keyframes stepFadeIn {
      0% {
        opacity: 0;
        transform: translateY(6px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .erp-stepper-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      opacity: 0.4;
      gap: 0.5rem;

      i {
        font-size: 2.5rem;
      }
    }

    /* PrimeNG Stepper unstyled styling overrides */
    ::ng-deep {
      .p-stepper {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .p-step-list {
        display: flex;
        align-items: center;
        width: 100%;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        padding-bottom: 1rem;
        gap: 1rem;
      }

      .p-step {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: relative;
      }

      .p-step-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        transition: background 0.2s;
        font-family: inherit;
        font-weight: 500;
        color: var(--text-muted, #64748b);

        &:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }

      .p-step-active .p-step-header {
        color: var(--primary-color, #3b82f6);
        font-weight: 600;
      }

      .p-step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 50%;
        border: 2px solid currentColor;
        font-size: 0.875rem;
      }

      .p-stepper-separator {
        flex: 1 1 0%;
        height: 2px;
        background-color: var(--border-color, #e2e8f0);
        margin: 0 0.5rem;
      }

      .p-step-active ~ .p-step .p-stepper-separator {
        background-color: var(--border-color, #e2e8f0);
      }

      .p-steppanel {
        outline: 0 none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpStepperComponent {
  public config = input.required<ErpStepperConfig>();

  protected internalLoading = signal(false);
  protected internalValue = signal<number | undefined>(undefined);

  protected unwrappedItems = computed(() => {
    const rawItems = unwrapSignal(this.config().items) || [];
    return rawItems.map(item => ({
      ...item,
      label: unwrapSignal(item.label),
      value: unwrapSignal(item.value),
      disabled: unwrapSignal(item.disabled),
      component: unwrapSignal(item.component),
      config: unwrapSignal(item.config),
    }));
  });

  protected linear = computed(() => !!unwrapSignal(this.config().linear));

  protected activeValue = computed(() => {
    const items = this.unwrappedItems();
    const currentVal = this.internalValue() ?? unwrapSignal(this.config().initialValue);

    const activeStep = items.find(i => i.value === currentVal);
    if (activeStep && !activeStep.disabled) {
      return currentVal;
    }

    const firstEnabled = items.find(i => !i.disabled);
    return firstEnabled?.value;
  });

  constructor() {
    effect(() => {
      const active = this.activeValue();
      const internal = this.internalValue();

      if (active !== internal) {
        untracked(() => {
          this.handleValueChange(active);
        });
      }
    });
  }

  protected handleValueChange(newValue: any): void {
    if (newValue === undefined || newValue === null) return;
    const numericValue = Number(newValue);
    this.internalValue.set(numericValue);
    if (this.config().onStepChange) {
      this.config().onStepChange!(numericValue);
    }
  }
}
