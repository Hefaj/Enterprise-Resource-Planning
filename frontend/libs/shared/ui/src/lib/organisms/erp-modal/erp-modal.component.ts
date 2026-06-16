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
import { TranslocoModule } from '@jsverse/transloco';
import { ErpModalConfig } from './erp-modal.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { provideSharedTranslations, SHARED_KEYS } from '../../translation';

@Component({
  selector: 'erp-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TranslocoModule],
  providers: [provideSharedTranslations()],
  template: `
    @let _title = title();
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
      [draggable]="!maximized()"
      [resizable]="false"
      [closable]="false"
      [styleClass]="'erp-modal ' + _sizeClass + (maximized() ? ' erp-modal--maximized' : '')"
      [dismissableMask]="true"
      (onHide)="handleCancel()"
    >
      <!-- ═══ HEADER ═══ -->
      <ng-template #header>
        <div class="erp-modal-header">
          <div class="erp-modal-header__left">
            <h2 class="erp-modal-header__title">
              @for (item of _title; track $index) {
                <span [class.erp-modal-header__segment--muted]="!$last">{{ item | transloco }}</span>
                @if (!$last) {
                  <span class="erp-modal-header__separator">></span>
                }
               }
            </h2>
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
                    {{ unwrapLabel(step.label) | transloco }}
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

          <div class="erp-modal-header__actions">
            <button
              class="erp-modal-header__maximize"
              type="button"
              (click)="maximized.set(!maximized())"
              [aria-label]="maximized() ? 'Zminimalizuj modal' : 'Zmaksymalizuj modal'"
            >
              <i [class]="maximized() ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"></i>
            </button>
            <button
              class="erp-modal-header__close"
              type="button"
              (click)="handleCancel()"
              aria-label="Zamknij modal"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
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
                [label]="cancelLabel() | transloco"
                severity="secondary"
                [variant]="'text'"
                (onClick)="handleCancel()"
              />
            </div>

            <div class="erp-modal-footer__right">
              @if (_showStepper && !_isFirstStep) {
                <p-button
                  [label]="backLabel() | transloco"
                  severity="secondary"
                  [variant]="'outlined'"
                  icon="pi pi-arrow-left"
                  (onClick)="goBack()"
                />
              }

              @if (_isLastStep) {
                <p-button
                  [label]="saveLabel() | transloco"
                  icon="pi pi-check"
                  [loading]="_loading"
                  [disabled]="!_canGoNext"
                  (onClick)="handleSave()"
                />
              } @else {
                <p-button
                  [label]="nextLabel() | transloco"
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
        border: 1px solid var(--p-surface-200);
        background: var(--p-surface-0);
        box-shadow:
          0 25px 50px -12px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(0, 0, 0, 0.03);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .erp-modal .p-dialog-header {
        padding: 0;
        border-bottom: 1px solid var(--p-surface-200);
        background: transparent;
        flex-shrink: 0;
      }

      .erp-modal .p-dialog-content {
        padding: 0;
        background: transparent;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        overflow-y: hidden;
      }

      .erp-modal .p-dialog-footer {
        padding: 0;
        border-top: 1px solid var(--p-surface-200);
        background: transparent;
        flex-shrink: 0;
      }

      .erp-modal .p-dialog-mask {
        backdrop-filter: blur(4px);
        background: rgba(0, 0, 0, 0.4);
      }

      /* ── Dark mode structural overrides ── */
      .dark .erp-modal.p-dialog,
      [data-theme="dark"] .erp-modal.p-dialog {
        background: var(--p-surface-900, #18181b);
        border-color: var(--p-surface-800, #27272a);
        color: var(--p-surface-100, #f4f4f5);
      }

      .dark .erp-modal .p-dialog-header,
      [data-theme="dark"] .erp-modal .p-dialog-header,
      .dark .erp-modal .p-dialog-footer,
      [data-theme="dark"] .erp-modal .p-dialog-footer {
        border-color: var(--p-surface-800, #27272a);
      }

      .dark .erp-modal .p-dialog-mask,
      [data-theme="dark"] .erp-modal .p-dialog-mask {
        background: rgba(0, 0, 0, 0.6);
      }

      /* ── Size variants with rigid heights ── */
      .erp-modal--sm.p-dialog { width: 400px; max-width: 95vw; height: 400px; }
      .erp-modal--md.p-dialog { width: 600px; max-width: 95vw; height: 500px; }
      .erp-modal--lg.p-dialog { width: 800px; max-width: 95vw; height: 600px; }
      .erp-modal--xl.p-dialog { width: 1100px; max-width: 95vw; height: 700px; }
      .erp-modal--full.p-dialog { width: 95vw; height: 90vh; }

      /* Fullscreen maximized mode */
      .erp-modal--maximized.p-dialog {
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        top: 0 !important;
        left: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        transform: none !important;
      }
    }

    /* ── Header ── */
    .erp-modal-header {
      display: flex;
      align-items: center;
      padding: 1.25rem 1.5rem;
      gap: 1rem;
      width: 100%;
      box-sizing: border-box;
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }

    .erp-modal-header__left {
      flex-shrink: 0;
    }

    .erp-modal-header__title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--p-surface-800);
      line-height: 1.4;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .erp-modal-header__separator {
      color: var(--p-surface-400);
      font-weight: 400;
      font-size: 0.875rem;
      user-select: none;
    }

    .erp-modal-header__segment--muted {
      color: var(--p-surface-500);
      font-weight: 500;
    }

    .erp-modal-header__stepper {
      display: flex;
      align-items: center;
      flex: 1;
      justify-content: center;
      gap: 0;
    }

    .erp-modal-header__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: auto;
      flex-shrink: 0;
    }

    .erp-modal-header__maximize,
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
      color: var(--p-surface-500);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: var(--p-surface-100);
        color: var(--p-surface-900);
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
      border: 2px solid var(--p-surface-200);
      color: var(--p-surface-400);
      background: transparent;
      transition: all 0.2s ease;

      i {
        font-size: 0.625rem;
      }
    }

    .erp-modal-step-indicator__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--p-surface-400);
      transition: color 0.2s ease;
      white-space: nowrap;
    }

    .erp-modal-step-indicator--active {
      .erp-modal-step-indicator__dot {
        border-color: var(--p-primary-500);
        color: var(--p-primary-500);
        background: rgba(59, 130, 246, 0.08);
      }

      .erp-modal-step-indicator__label {
        color: var(--p-primary-500);
        font-weight: 600;
      }
    }

    .erp-modal-step-indicator--completed {
      .erp-modal-step-indicator__dot {
        border-color: var(--p-green-500);
        background: var(--p-green-500);
        color: #fff;
      }

      .erp-modal-step-indicator__label {
        color: var(--p-surface-700);
      }
    }

    .erp-modal-step-separator {
      width: 2rem;
      height: 2px;
      background: var(--p-surface-200);
      transition: background 0.2s ease;
    }

    .erp-modal-step-separator--completed {
      background: var(--p-green-500);
    }

    /* ── Body ── */
    .erp-modal-body {
      padding: 1.5rem;
      flex: 1 1 auto;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .erp-modal-body__content {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
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
      width: 100%;
      box-sizing: border-box;
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

    /* ── Dark mode overrides for internal classes ── */
    :host-context(.dark),
    :host-context([data-theme="dark"]) {
      .erp-modal-header__title {
        color: var(--p-surface-100, #f4f4f5);
      }
      .erp-modal-header__segment--muted {
        color: var(--p-surface-400, #a1a1aa);
      }
      .erp-modal-header__separator {
        color: var(--p-surface-500, #71717a);
      }
      .erp-modal-header__maximize,
      .erp-modal-header__close {
        color: var(--p-surface-400, #a1a1aa);
        &:hover {
          background: var(--p-surface-800, #27272a);
          color: var(--p-surface-100, #f4f4f5);
        }
      }
      .erp-modal-step-indicator__dot {
        border-color: var(--p-surface-700, #3f3f46);
        color: var(--p-surface-400, #a1a1aa);
      }
      .erp-modal-step-indicator__label {
        color: var(--p-surface-400, #a1a1aa);
      }
      .erp-modal-step-indicator--active {
        .erp-modal-step-indicator__dot {
          border-color: var(--p-primary-500, #3b82f6);
          color: var(--p-primary-500, #3b82f6);
          background: rgba(59, 130, 246, 0.15);
        }
        .erp-modal-step-indicator__label {
          color: var(--p-primary-500, #3b82f6);
        }
      }
      .erp-modal-step-indicator--completed {
        .erp-modal-step-indicator__dot {
          border-color: var(--p-green-500, #22c55e);
          background: var(--p-green-500, #22c55e);
          color: #fff;
        }
        .erp-modal-step-indicator__label {
          color: var(--p-surface-200, #e4e4e7);
        }
      }
      .erp-modal-step-separator {
        background: var(--p-surface-700, #3f3f46);
      }
      .erp-modal-step-separator--completed {
        background: var(--p-green-500, #22c55e);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpModalComponent<TCommand = any, TMetadata = any> {
  public config = input.required<ErpModalConfig<TCommand, TMetadata>>();

  /** Widoczność modalu — zarządzana przez serwis. */
  public visible = signal(true);

  /** Stan maksymalizacji modalu. */
  public maximized = signal(false);

  /** Aktualny indeks kroku. */
  public currentStep = signal(0);

  /** Loading state dla async onSave. */
  protected internalLoading = signal(false);

  /** WritableSignal przechowujący stan commanda. */
  public commandSignal!: WritableSignal<TCommand>;

  /** WritableSignal przechowujący stan metadanych. */
  public metadataSignal!: WritableSignal<TMetadata>;

  /** Mapa canGoNext Signal per step index. */
  private _stepCanGoNextMap = new Map<number, Signal<boolean>>();

  // ── Computed properties ──

  protected title = computed<string[]>(() => {
    const raw = unwrapSignal(this.config().title);
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  });

  protected showStepper = computed(() => this.config().steps.length > 1);

  protected isLastStep = computed(
    () => this.currentStep() === this.config().steps.length - 1
  );

  protected isFirstStep = computed(() => this.currentStep() === 0);

  protected showFooter = computed(() => this.config().showFooter !== false);

  protected saveLabel = computed(
    () => unwrapSignal(this.config().saveLabel) || SHARED_KEYS.modal.save
  );

  protected cancelLabel = computed(
    () => unwrapSignal(this.config().cancelLabel) || SHARED_KEYS.modal.cancel
  );

  protected nextLabel = computed(
    () => unwrapSignal(this.config().nextLabel) || SHARED_KEYS.modal.next
  );

  protected backLabel = computed(
    () => unwrapSignal(this.config().backLabel) || SHARED_KEYS.modal.back
  );

  protected sizeClass = computed(() => {
    const size = unwrapSignal(this.config().size) || 'md';
    return `erp-modal--${size}`;
  });

  protected canGoNext = computed(() => {
    const stepSignal = this._stepCanGoNextMap.get(this.currentStep());
    return stepSignal ? stepSignal() : true;
  });

  /** Inicjalizuje commandSignal i metadataSignal z konfiguracji. Wywoływane przez serwis. */
  public initCommand(): void {
    const cmd = this.config().command;
    this.commandSignal = signal(cmd as TCommand) as WritableSignal<TCommand>;
    const meta = this.config().metadata;
    this.metadataSignal = signal(meta as TMetadata) as WritableSignal<TMetadata>;
  }

  /** Zwraca inputy przekazywane do step component via ngComponentOutlet. */
  protected getStepInputs(stepIndex: number): Record<string, any> {
    const step = this.config().steps[stepIndex];
    const baseInputs: Record<string, any> = {
      command: this.commandSignal,
      metadata: this.metadataSignal,
      registerCanGoNext: (canGoNextSignal: Signal<boolean>) => {
        this._stepCanGoNextMap.set(stepIndex, canGoNextSignal);
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
      const result = onSave(
        this.commandSignal?.() as TCommand,
        this.metadataSignal?.() as TMetadata
      );
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
