import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ErpModalConfig } from './erp-modal.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    @let _title = title();
    @let _visible = visible();
    @let _steps = config().steps;
    @let _currentStep = currentStep();
    @let _showStepper = showStepper();
    @let _isLastStep = isLastStep();
    @let _isFirstStep = isFirstStep();
    @let _showFooter = showFooter();
    @let _canGoNext = canGoNext();
    @let _loading = internalLoading();
    @let _sizeClass = sizeClass();

    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="false"
      [styleClass]="'erp-modal ' + _sizeClass"
      [dismissableMask]="true"
      (onHide)="handleCancel()"
    >
      <!-- ═══ HEADER ═══ -->
      <ng-template #header>
        <div class="erp-modal-header">
          <div class="erp-modal-header__left">
            <h2 class="erp-modal-header__title">{{ _title }}</h2>
          </div>

          @if (_showStepper) {
            <div class="erp-modal-header__stepper">
              @for (step of _steps; track $index) {
                <div
                  class="erp-modal-step-indicator"
                  [class.erp-modal-step-indicator--active]="$index === _currentStep"
                  [class.erp-modal-step-indicator--completed]="$index < _currentStep"
                >
                  <div class="erp-modal-step-indicator__dot">
                    @if ($index < _currentStep) {
                      <i class="pi pi-check"></i>
                    } @else {
                      {{ $index + 1 }}
                    }
                  </div>
                  <span class="erp-modal-step-indicator__label">
                    {{ unwrapLabel(step.label) }}
                  </span>
                </div>
                @if (!$last) {
                  <div
                    class="erp-modal-step-separator"
                    [class.erp-modal-step-separator--completed]="$index < _currentStep"
                  ></div>
                }
              }
            </div>
          }

          <button
            class="erp-modal-header__close"
            type="button"
            (click)="handleCancel()"
            aria-label="Zamknij modal"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <!-- ═══ BODY ═══ -->
      <div class="erp-modal-body">
        @for (step of _steps; track $index) {
          @if ($index === _currentStep) {
            <div class="erp-modal-body__content">
              <ng-container
                *ngComponentOutlet="step.component; inputs: getStepInputs($index)"
              />
            </div>
          }
        }
      </div>

      <!-- ═══ FOOTER ═══ -->
      @if (_showFooter) {
        <ng-template #footer>
          <div class="erp-modal-footer">
            <div class="erp-modal-footer__left">
              <p-button
                [label]="cancelLabel()"
                severity="secondary"
                [variant]="'text'"
                (onClick)="handleCancel()"
              />
            </div>

            <div class="erp-modal-footer__right">
              @if (_showStepper && !_isFirstStep) {
                <p-button
                  [label]="backLabel()"
                  severity="secondary"
                  [variant]="'outlined'"
                  icon="pi pi-arrow-left"
                  (onClick)="goBack()"
                />
              }

              @if (_isLastStep) {
                <p-button
                  [label]="saveLabel()"
                  icon="pi pi-check"
                  [loading]="_loading"
                  [disabled]="!_canGoNext"
                  (onClick)="handleSave()"
                />
              } @else {
                <p-button
                  [label]="nextLabel()"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  [disabled]="!_canGoNext"
                  (onClick)="goNext()"
                />
              }
            </div>
          </div>
        </ng-template>
      }
    </p-dialog>
  `,
  styles: `
    :host {
      display: contents;
    }

    /* ── PrimeNG Dialog unstyled overrides ── */
    ::ng-deep {
      .erp-modal.p-dialog {
        border-radius: 12px;
        border: 1px solid var(--border-color, rgba(226, 232, 240, 0.6));
        background: var(--surface-card, #ffffff);
        box-shadow:
          0 25px 50px -12px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(0, 0, 0, 0.03);
        overflow: hidden;
      }

      .erp-modal .p-dialog-header {
        padding: 0;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        background: transparent;
      }

      .erp-modal .p-dialog-content {
        padding: 0;
        background: transparent;
      }

      .erp-modal .p-dialog-footer {
        padding: 0;
        border-top: 1px solid var(--border-color, #e2e8f0);
        background: transparent;
      }

      .erp-modal .p-dialog-mask {
        backdrop-filter: blur(4px);
        background: rgba(0, 0, 0, 0.4);
      }

      /* ── Size variants ── */
      .erp-modal--sm.p-dialog { width: 400px; max-width: 95vw; }
      .erp-modal--md.p-dialog { width: 600px; max-width: 95vw; }
      .erp-modal--lg.p-dialog { width: 800px; max-width: 95vw; }
      .erp-modal--xl.p-dialog { width: 1100px; max-width: 95vw; }
      .erp-modal--full.p-dialog { width: 95vw; height: 90vh; }
    }

    /* ── Header ── */
    .erp-modal-header {
      display: flex;
      align-items: center;
      padding: 1.25rem 1.5rem;
      gap: 1rem;
    }

    .erp-modal-header__left {
      flex-shrink: 0;
    }

    .erp-modal-header__title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-color, #1e293b);
      line-height: 1.4;
    }

    .erp-modal-header__stepper {
      display: flex;
      align-items: center;
      flex: 1;
      justify-content: center;
      gap: 0;
    }

    .erp-modal-header__close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-muted, #64748b);
      cursor: pointer;
      transition: all 0.15s ease;
      margin-left: auto;

      &:hover {
        background: var(--surface-hover, #f1f5f9);
        color: var(--text-color, #1e293b);
      }

      i {
        font-size: 0.875rem;
      }
    }

    /* ── Step indicators ── */
    .erp-modal-step-indicator {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
    }

    .erp-modal-step-indicator__dot {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 600;
      border: 2px solid var(--border-color, #cbd5e1);
      color: var(--text-muted, #94a3b8);
      background: transparent;
      transition: all 0.2s ease;

      i {
        font-size: 0.625rem;
      }
    }

    .erp-modal-step-indicator__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-muted, #94a3b8);
      transition: color 0.2s ease;
      white-space: nowrap;
    }

    .erp-modal-step-indicator--active {
      .erp-modal-step-indicator__dot {
        border-color: var(--primary-color, #3b82f6);
        color: var(--primary-color, #3b82f6);
        background: var(--primary-color-alpha, rgba(59, 130, 246, 0.08));
      }

      .erp-modal-step-indicator__label {
        color: var(--primary-color, #3b82f6);
        font-weight: 600;
      }
    }

    .erp-modal-step-indicator--completed {
      .erp-modal-step-indicator__dot {
        border-color: var(--green-500, #22c55e);
        background: var(--green-500, #22c55e);
        color: #fff;
      }

      .erp-modal-step-indicator__label {
        color: var(--text-color, #475569);
      }
    }

    .erp-modal-step-separator {
      width: 2rem;
      height: 2px;
      background: var(--border-color, #e2e8f0);
      transition: background 0.2s ease;
    }

    .erp-modal-step-separator--completed {
      background: var(--green-500, #22c55e);
    }

    /* ── Body ── */
    .erp-modal-body {
      padding: 1.5rem;
    }

    .erp-modal-body__content {
      animation: erpModalFadeIn 0.2s cubic-bezier(0, 0, 0.2, 1) forwards;
    }

    @keyframes erpModalFadeIn {
      0% {
        opacity: 0;
        transform: translateX(8px);
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* ── Footer ── */
    .erp-modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
    }

    .erp-modal-footer__left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .erp-modal-footer__right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpModalComponent<TCommand = any> {
  public config = input.required<ErpModalConfig<TCommand>>();

  /** Widoczność modalu — zarządzana przez serwis. */
  public visible = signal(true);

  /** Aktualny indeks kroku. */
  public currentStep = signal(0);

  /** Loading state dla async onSave. */
  protected internalLoading = signal(false);

  /** WritableSignal przechowujący stan commanda. */
  public commandSignal!: WritableSignal<TCommand>;

  /** Mapa canGoNext Signal per step index. */
  private stepCanGoNextMap = new Map<number, Signal<boolean>>();

  // ── Computed properties ──

  protected title = computed(() => unwrapSignal(this.config().title) || '');

  protected showStepper = computed(() => this.config().steps.length > 1);

  protected isLastStep = computed(
    () => this.currentStep() === this.config().steps.length - 1
  );

  protected isFirstStep = computed(() => this.currentStep() === 0);

  protected showFooter = computed(() => this.config().showFooter !== false);

  protected saveLabel = computed(
    () => unwrapSignal(this.config().saveLabel) || 'Zapisz'
  );

  protected cancelLabel = computed(
    () => unwrapSignal(this.config().cancelLabel) || 'Anuluj'
  );

  protected nextLabel = computed(
    () => unwrapSignal(this.config().nextLabel) || 'Dalej'
  );

  protected backLabel = computed(
    () => unwrapSignal(this.config().backLabel) || 'Wstecz'
  );

  protected sizeClass = computed(() => {
    const size = unwrapSignal(this.config().size) || 'md';
    return `erp-modal--${size}`;
  });

  protected canGoNext = computed(() => {
    const stepSignal = this.stepCanGoNextMap.get(this.currentStep());
    return stepSignal ? stepSignal() : true;
  });

  /** Inicjalizuje commandSignal z konfiguracji. Wywoływane przez serwis. */
  public initCommand(): void {
    const cmd = this.config().command;
    this.commandSignal = signal(cmd as TCommand) as WritableSignal<TCommand>;
  }

  /** Zwraca inputy przekazywane do step component via ngComponentOutlet. */
  protected getStepInputs(stepIndex: number): Record<string, any> {
    const step = this.config().steps[stepIndex];
    const baseInputs: Record<string, any> = {
      command: this.commandSignal,
      registerCanGoNext: (canGoNextSignal: Signal<boolean>) => {
        this.stepCanGoNextMap.set(stepIndex, canGoNextSignal);
      },
    };

    if (step.inputs) {
      return { ...baseInputs, ...step.inputs };
    }

    return baseInputs;
  }

  /** Helper do unwrapowania MaybeSignal w template. */
  protected unwrapLabel(label: any): string {
    return (unwrapSignal(label) as string) || '';
  }

  // ── Nawigacja ──

  protected goNext(): void {
    if (!this.canGoNext()) return;
    const next = this.currentStep() + 1;
    if (next < this.config().steps.length) {
      this.currentStep.set(next);
    }
  }

  protected goBack(): void {
    const prev = this.currentStep() - 1;
    if (prev >= 0) {
      this.currentStep.set(prev);
    }
  }

  protected async handleSave(): Promise<void> {
    if (!this.canGoNext()) return;

    const onSave = this.config().onSave;
    if (onSave) {
      const result = onSave(this.commandSignal?.() as TCommand);
      if (result instanceof Promise) {
        this.internalLoading.set(true);
        try {
          await result;
        } finally {
          this.internalLoading.set(false);
        }
      }
    }
    this.visible.set(false);
  }

  protected handleCancel(): void {
    if (this.internalLoading()) return;
    const onCancel = this.config().onCancel;
    if (onCancel) {
      onCancel();
    }
    this.visible.set(false);
  }
}
