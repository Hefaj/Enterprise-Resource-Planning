import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { TuiDialogContext, TuiIcon } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { ErpButtonComponent } from '../erp-button/erp-button.component';
import { ErpButtonConfig } from '../erp-button/erp-button.types';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpModalConfig } from './erp-modal.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpStepperComponent } from '../erp-stepper/erp-stepper.component';
import { provideSharedTranslations, SHARED_KEYS } from '../../translation';

@Component({
  selector: 'erp-modal',
  standalone: true,
  imports: [
    CommonModule,
    NgComponentOutlet,
    TuiIcon,
    ErpButtonComponent,
    ErpTranslatePipe,
    ErpStepperComponent,
  ],
  template: `
    @let _title = title();
    @let _steps = config().steps;
    @let _currentStep = currentStep();
    @let _showStepper = showStepper();
    @let _isLastStep = isLastStep();
    @let _isFirstStep = isFirstStep();
    @let _showFooter = showFooter();
    @let _sizeClass = sizeClass();

    <div class="erp-modal" [ngClass]="_sizeClass">
      <!-- ═══ HEADER ═══ -->
      <div class="erp-modal-header">
        <div class="erp-modal-header__top-row">
          <div class="erp-modal-header__left">
            <h2 class="erp-modal-header__title">
              @for (item of _title; track $index) {
                <span [class.erp-modal-header__segment--muted]="!$last">{{ item | erpTranslate }}</span>
                @if (!$last) {
                  <span class="erp-modal-header__separator">></span>
                }
               }
            </h2>
          </div>

          <div class="erp-modal-header__actions">
            <button
              class="erp-modal-header__maximize"
              type="button"
              (click)="toggleMaximize()"
              [aria-label]="maximized() ? 'Zminimalizuj modal' : 'Zmaksymalizuj modal'"
            >
              <tui-icon [icon]="maximized() ? '@tui.minimize-2' : '@tui.maximize-2'" />
            </button>
            <button
              class="erp-modal-header__close"
              type="button"
              (click)="handleCancel()"
              aria-label="Zamknij modal"
            >
              <tui-icon icon="@tui.x" />
            </button>
          </div>
        </div>

        @if (_showStepper) {
          <erp-stepper
            [config]="stepperConfig()"
            class="erp-modal-header__stepper"
          />
        }
      </div>

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
        <div class="erp-modal-footer">
          <div class="erp-modal-footer__left">
            <erp-button [config]="cancelBtnConfig()" />
          </div>

          <div class="erp-modal-footer__right">
            @if (_showStepper && !_isFirstStep) {
              <erp-button [config]="backBtnConfig()" />
            }

            @if (_isLastStep) {
              <erp-button [config]="saveBtnConfig()" />
            } @else {
              <erp-button [config]="nextBtnConfig()" />
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    ::ng-deep {
      tui-dialog-card:not([data-appearance~=fullscreen]),
      dialog:not([data-appearance~=fullscreen]),
      .t-dialog:not([data-appearance~=fullscreen]) {
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
        max-width: none !important;
        max-height: none !important;
      }
    }

    .erp-modal {
      border-radius: 12px;
      border: 1px solid var(--p-surface-200);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      width: 100%;
      box-sizing: border-box;
      min-height: 200px;
    }

    .erp-modal-header {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      width: 100%;
      box-sizing: border-box;
      border-bottom: 1px solid var(--p-surface-200);
    }

    .erp-modal-header__top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .erp-modal-header__title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
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
    }

    .erp-modal-header__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .erp-modal-header__maximize,
    .erp-modal-header__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      background: transparent;
      cursor: pointer;

      &:hover {
        background: var(--p-surface-100);
        color: var(--p-surface-900);
      }
    }

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

      tui-icon {
        width: 0.875rem;
        height: 0.875rem;
      }
    }

    .erp-modal-step-indicator__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--p-surface-400);
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
    }

    .erp-modal-step-separator--completed {
      background: var(--p-green-500);
    }

    .erp-modal-body {
      flex: 1 1 auto;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .erp-modal-body__content {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
    }

    .erp-modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      box-sizing: border-box;
      border-top: 1px solid var(--p-surface-200);
    }

    .erp-modal-footer__left,
    .erp-modal-footer__right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    :host-context(.dark),
    :host-context([data-theme="dark"]) {
      .erp-modal {
        border-color: var(--p-surface-800, #27272a);
      }
      .erp-modal-header {
        border-bottom-color: var(--p-surface-800, #27272a);
      }
      .erp-modal-footer {
        border-top-color: var(--p-surface-800, #27272a);
      }
      .erp-modal-header__maximize,
      .erp-modal-header__close {
        &:hover {
          background: var(--p-surface-800, #27272a);
          color: var(--p-surface-100, #f4f4f5);
        }
      }
      .erp-modal-step-indicator__dot {
        border-color: var(--p-surface-700, #3f3f46);
      }
      .erp-modal-step-indicator--active {
        .erp-modal-step-indicator__dot {
          border-color: var(--p-primary-500, #3b82f6);
          color: var(--p-primary-500, #3b82f6);
        }
      }
      .erp-modal-step-indicator--completed {
        .erp-modal-step-indicator__dot {
          border-color: var(--p-green-500, #22c55e);
          background: var(--p-green-500, #22c55e);
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
export class ErpModalComponent<TCommand = any, TMetadata = any> implements OnDestroy {
  private readonly context = inject<TuiDialogContext<any, ErpModalConfig>>(POLYMORPHEUS_CONTEXT);

  public config = computed(() => this.context.data);

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
  private _stepCanGoNextMap = signal<Record<number, Signal<boolean>>>({});

  private resolved = false;

  constructor() {
    const data = this.context.data as any;
    this.commandSignal = data.commandSignal || signal(data.command);
    this.metadataSignal = data.metadataSignal || signal(data.metadata);

    const initialSize = unwrapSignal(data.size) || 'md';
    if (initialSize === 'full') {
      this.maximized.set(true);
      (this.context as any).appearance = 'fullscreen';
    }
  }

  public toggleMaximize(): void {
    const nextMaximized = !this.maximized();
    this.maximized.set(nextMaximized);

    const data = this.context.data as any;
    if (nextMaximized) {
      (this.context as any).appearance = 'fullscreen';
    } else {
      (this.context as any).appearance = 'taiga';
      const size = unwrapSignal(data.size) || 'md';
      (this.context as any).size = this._mapTuiSize(size);
    }
  }

  private _mapTuiSize(size: string): 's' | 'm' | 'l' {
    if (size === 'sm') return 's';
    if (size === 'md') return 'm';
    if (size === 'lg') return 'l';
    if (size === 'xl') return 'l';
    if (size === 'full') return 'l';
    return 'm';
  }

  // ── Computed properties ──

  protected title = computed<Translatable[]>(() => {
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
    const map = this._stepCanGoNextMap();
    const stepSignal = map[this.currentStep()];
    return stepSignal ? stepSignal() : true;
  });

  protected stepperConfig = computed(() => {
    const stepLabels = this.config().steps.map(step => this.unwrapLabel(step.label));
    return {
      steps: stepLabels,
      activeItemIndex: this.currentStep(),
      orientation: 'horizontal' as const,
    };
  });

  // ── Button Configurations ──

  protected cancelBtnConfig = computed<ErpButtonConfig>(() => ({
    label: this.cancelLabel(),
    appearance: 'flat',
    fn: () => this.handleCancel(),
  }));

  protected backBtnConfig = computed<ErpButtonConfig>(() => ({
    label: this.backLabel(),
    appearance: 'outline',
    iconStart: '@tui.arrow-left',
    fn: () => this.goBack(),
  }));

  protected saveBtnConfig = computed<ErpButtonConfig>(() => ({
    label: this.saveLabel(),
    appearance: 'primary',
    iconStart: '@tui.check',
    loading: this.internalLoading(),
    disabled: !this.canGoNext(),
    fn: () => this.handleSave(),
  }));

  protected nextBtnConfig = computed<ErpButtonConfig>(() => ({
    label: this.nextLabel(),
    appearance: 'primary',
    iconEnd: '@tui.arrow-right',
    disabled: !this.canGoNext(),
    fn: () => this.goNext(),
  }));

  /** Zwraca inputy przekazywane do step component via ngComponentOutlet. */
  protected getStepInputs(stepIndex: number): Record<string, any> {
    const step = this.config().steps[stepIndex];
    const baseInputs: Record<string, any> = {
      command: this.commandSignal,
      metadata: this.metadataSignal,
      registerCanGoNext: (canGoNextSignal: Signal<boolean>) => {
        this._stepCanGoNextMap.update(map => ({
          ...map,
          [stepIndex]: canGoNextSignal
        }));
      },
    };

    if (step.inputs) {
      return { ...baseInputs, ...step.inputs };
    }

    return baseInputs;
  }

  /** Helper do unwrapowania MaybeSignal w template. */
  protected unwrapLabel(label: any): Translatable {
    return unwrapSignal(label) || '';
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
    let saveResult: any = undefined;
    if (onSave) {
      const result = onSave(
        this.commandSignal?.() as TCommand,
        this.metadataSignal?.() as TMetadata
      );
      if (result instanceof Promise) {
        this.internalLoading.set(true);
        try {
          saveResult = await result;
        } finally {
          this.internalLoading.set(false);
        }
      } else {
        saveResult = result;
      }
    }
    this.resolved = true;
    this.context.$implicit.next({
      command: this.commandSignal?.() as TCommand,
      metadata: this.metadataSignal?.() as TMetadata,
      saved: true,
      result: saveResult
    });
    this.context.$implicit.complete();
  }

  protected handleCancel(): void {
    if (this.internalLoading()) return;
    const onCancel = this.config().onCancel;
    if (onCancel) {
      onCancel();
    }
    this.resolved = true;
    this.context.$implicit.next({
      command: this.commandSignal?.() as TCommand,
      metadata: this.metadataSignal?.() as TMetadata,
      saved: false
    });
    this.context.$implicit.complete();
  }

  ngOnDestroy(): void {
    if (!this.resolved) {
      const onCancel = this.config().onCancel;
      if (onCancel) {
        onCancel();
      }
      this.context.$implicit.next({
        command: this.commandSignal?.() as TCommand,
        metadata: this.metadataSignal?.() as TMetadata,
        saved: false
      });
    }
  }
}
