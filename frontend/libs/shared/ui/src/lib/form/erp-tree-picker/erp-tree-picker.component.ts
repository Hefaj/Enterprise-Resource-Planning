import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { TuiTextfield, TuiLabel, TuiErrorComponent, TuiDropdown, TuiIcon, TuiButtonX } from '@taiga-ui/core';
import { TuiInputDirective } from '@taiga-ui/core/components/input';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { noop } from 'rxjs';

import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal, Translatable, MaybeSignal } from '../../base/erp-signal-utils';
import { SHARED_KEYS } from '../../translation/keys';
import {
  ErpTreeBuilder,
  ErpTreeComponent,
  ErpTreeConfig,
  ErpTreeMode,
  ErpTreeSelectionState,
  ErpTreeSelectionValue,
} from '../../atoms/erp-tree';
import { emptySelection } from '../../atoms/erp-tree/erp-tree-selection.model';
import { ErpTreePickerConfig } from './erp-tree-picker.types';

@Component({
  selector: 'erp-tree-picker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfield,
    TuiInputDirective,
    TuiLabel,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    TuiDropdown,
    TuiButtonX,
    ErpTranslatePipe,
    ErpTreeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpTreePickerComponent),
      multi: true,
    },
  ],
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || (_searchPlaceholder() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';
    @let tooltipText = (_tooltip() | erpTranslate) || '';

    <div class="erp-tree-picker-wrapper">
      <tui-textfield
        [tuiTextfieldSize]="_size()"
        [tuiTextfieldCleaner]="false"
        [open]="isOpen()"
        (openChange)="onDropdownOpenChange($event)"
      >
        @if (labelText) {
          <label tuiLabel>{{ labelText }}</label>
        }
        <input
          tuiInput
          type="text"
          [readOnly]="true"
          [value]="displayText()"
          [disabled]="_disabled()"
          [placeholder]="placeholderText"
          [invalid]="_invalid()"
        />
        @if (marksCount() > 0 && !_disabled()) {
          <button type="button" tuiButtonX tabindex="-1" (click)="clearSelectionValue($event)">
            {{ SHARED_KEYS.tree.clear | erpTranslate }}
          </button>
        }
        @if (tooltipText) {
          <tui-icon icon="@tui.circle-help" [tuiHint]="tooltipText" />
        }

        <div *tuiDropdown class="erp-tree-picker-panel">
          <erp-tree [config]="treeConfig()" class="erp-tree-picker-tree" />
        </div>
      </tui-textfield>

      @if (errorText) {
        <tui-error [error]="errorText" [class.erp-shake]="shake()" (animationend)="onShakeEnd($event)" />
      }

      @if (hintText) {
        <div class="erp-tree-picker-hint">{{ hintText }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    @keyframes erp-form-shake {
      0%, 100% { transform: translateX(0); }
      15%, 45%, 75% { transform: translateX(-4px); }
      30%, 60%, 90% { transform: translateX(4px); }
    }

    .erp-shake {
      animation: erp-form-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }

    .erp-tree-picker-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .erp-tree-picker-panel {
      display: flex;
      width: 100%;
      max-width: 22rem;
      height: 20rem;
      box-sizing: border-box;
      padding: 0;
    }

    .erp-tree-picker-tree {
      width: 100%;
      height: 100%;
    }

    .erp-tree-picker-hint {
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpTreePickerComponent<T = any> implements ControlValueAccessor {
  private readonly transloco = inject(TranslocoService, { optional: true });
  protected readonly SHARED_KEYS = SHARED_KEYS;

  readonly config = input.required<ErpTreePickerConfig<T>>();
  readonly control = input<FormControl<ErpTreeSelectionValue | null> | null>(null);

  readonly internalControl = new FormControl<ErpTreeSelectionValue | null>(emptySelection());
  readonly activeControl = computed(() => this.control() || this.internalControl);

  protected readonly isOpen = signal(false);
  protected readonly treeValue = signal<ErpTreeSelectionValue>(emptySelection());
  protected readonly lastTreeState = signal<ErpTreeSelectionState<T> | null>(null);

  protected readonly shake = signal<boolean>(false);
  private readonly stateTrigger = signal(0);
  private lastShakeTime = 0;

  private _onChange: (value: ErpTreeSelectionValue | null) => void = noop;
  protected onTouched: () => void = noop;

  constructor() {
    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.activeControl().setValue(configVal, { emitEvent: false });
          this.treeValue.set(configVal);
          this.stateTrigger.update((v) => v + 1);
        });
      }
    });

    effect(() => {
      const isDisabled = unwrapSignal(this.config().disabled);
      untracked(() => {
        if (isDisabled) {
          this.activeControl().disable({ emitEvent: false });
        } else {
          this.activeControl().enable({ emitEvent: false });
        }
        this.stateTrigger.update((v) => v + 1);
      });
    });

    effect((onCleanup) => {
      const ctrl = this.activeControl();
      const sub = ctrl.valueChanges.subscribe((val) => {
        this.treeValue.set(val ?? emptySelection());
        this.stateTrigger.update((v) => v + 1);
      });
      onCleanup(() => sub.unsubscribe());
    });

    this.internalControl.valueChanges.subscribe((val) => {
      this._onChange(val);
    });
  }

  protected readonly _mode = computed<ErpTreeMode>(() => unwrapSignal(this.config().mode)!);
  protected readonly _adapters = computed(() => this.config().adapters);
  protected readonly _strategy = computed(() => unwrapSignal(this.config().strategy) ?? 'multi');
  protected readonly _isMulti = computed(() => this._strategy() === 'multi');
  protected readonly _cascade = computed(() => unwrapSignal(this.config().cascade) ?? 'subtree');
  protected readonly _allowDescendantsOnly = computed(() => unwrapSignal(this.config().allowDescendantsOnly) ?? false);
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _searchPlaceholder = computed(() => unwrapSignal(this.config().searchPlaceholder));
  protected readonly _emptyContent = computed(() => unwrapSignal(this.config().emptyContent));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _disabled = computed(() => !!unwrapSignal(this.config().disabled));
  protected readonly _pageSize = computed(() => unwrapSignal(this.config().pageSize) ?? 50);
  protected readonly _estimatedRowHeight = computed(() => unwrapSignal(this.config().estimatedRowHeight) ?? 36);
  protected readonly _indentSize = computed(() => unwrapSignal(this.config().indentSize) ?? 20);

  protected readonly _maxCollapseCount = computed(() => {
    const val = unwrapSignal(this.config().maxCollapseCount);
    return typeof val === 'number' && val > 0 ? val : 3;
  });

  protected readonly marksCount = computed(() => {
    this.stateTrigger();
    return this.lastTreeState()?.marksCount ?? 0;
  });

  protected readonly displayText = computed(() => {
    this.stateTrigger();
    const state = this.lastTreeState();
    if (!state || state.marksCount === 0) return '';

    if (!this._isMulti()) {
      const item = state.markedItems[0];
      return item ? this.resolveLabelText(this._adapters().getLabel(item)) : '';
    }

    if (state.marksCount > this._maxCollapseCount()) {
      const template = this.transloco?.translate(SHARED_KEYS.tree.selectedCount, { count: state.marksCount });
      return template || `${state.marksCount}`;
    }

    return state.markedItems.map((item) => this.resolveLabelText(this._adapters().getLabel(item))).join(', ');
  });

  protected readonly _error = computed(() => {
    this.stateTrigger();
    const ctrl = this.activeControl();
    const isTouched = ctrl.touched || ctrl.dirty;
    const errors = ctrl.errors;
    if (isTouched && errors) {
      const firstErrorKey = Object.keys(errors)[0];
      const errorMessages = unwrapSignal(this.config().errorMessages) || {};
      return errorMessages[firstErrorKey] || `Błąd walidacji: ${firstErrorKey}`;
    }
    return undefined;
  });

  protected readonly _invalid = computed(() => !!this._error());

  protected readonly treeConfig = computed<ErpTreeConfig<T>>(() => {
    const cfg = this.config();
    const builder = new ErpTreeBuilder<T>()
      .setMode(this._mode())
      .setAdapters(this._adapters())
      .setSelectionMode(this._isMulti() ? 'multi' : 'single')
      .setCascade(this._cascade())
      .setAllowDescendantsOnly(this._allowDescendantsOnly())
      .setValue(this.treeValue())
      .setShowSearch(true)
      .setEstimatedRowHeight(this._estimatedRowHeight())
      .setIndentSize(this._indentSize())
      .setPageSize(this._pageSize())
      .setOnSelectionChange((state) => this.onTreeSelectionChange(state));

    if (cfg.items !== undefined) builder.setItems(cfg.items);
    if (cfg.loadChildrenFn) builder.setLoadChildrenFn(cfg.loadChildrenFn);
    if (cfg.searchFn) builder.setSearchFn(cfg.searchFn);
    if (cfg.searchPlaceholder !== undefined) builder.setSearchPlaceholder(cfg.searchPlaceholder);
    if (cfg.emptyContent !== undefined) builder.setEmptyMessage(cfg.emptyContent as MaybeSignal<Translatable>);

    return builder.build();
  });

  protected resolveLabelText(label: Translatable | undefined): string {
    if (!label) return '';
    if (typeof label === 'string') {
      return this.transloco?.translate(label) || label;
    }
    return this.transloco?.translate(label.key, label.params) || label.key;
  }

  protected onTreeSelectionChange(state: ErpTreeSelectionState<T>): void {
    this.lastTreeState.set(state);
    this.treeValue.set(state.value);
    this.stateTrigger.update((v) => v + 1);
    this.updateActiveValue(state.value);

    if (!this._isMulti() && state.marksCount > 0) {
      this.isOpen.set(false);
      this.onTouched();
      this.activeControl().markAsTouched();
    }
  }

  protected onDropdownOpenChange(open: boolean): void {
    this.isOpen.set(open);
    if (!open) {
      this.onTouched();
      this.activeControl().markAsTouched();
      this.stateTrigger.update((v) => v + 1);
      if (this._invalid()) this.triggerShakeIfInvalid();
    }
  }

  protected clearSelectionValue(event: Event): void {
    event.stopPropagation();
    const empty = emptySelection();
    this.treeValue.set(empty);
    this.lastTreeState.set(null);
    this.updateActiveValue(empty);
  }

  private updateActiveValue(val: ErpTreeSelectionValue): void {
    const ctrl = this.activeControl();
    ctrl.markAsDirty();
    ctrl.setValue(val);
    this._onChange(val);
    this.stateTrigger.update((v) => v + 1);
  }

  protected triggerShakeIfInvalid(): void {
    if (!this._invalid()) return;
    const now = Date.now();
    if (now - this.lastShakeTime < 100) return;
    this.lastShakeTime = now;
    if (this.shake()) {
      this.shake.set(false);
      setTimeout(() => this.shake.set(true), 10);
    } else {
      this.shake.set(true);
    }
  }

  protected onShakeEnd(event: AnimationEvent): void {
    if (event?.animationName === 'erp-form-shake') {
      this.shake.set(false);
    }
  }

  public writeValue(val: ErpTreeSelectionValue | null): void {
    this.internalControl.setValue(val ?? emptySelection(), { emitEvent: false });
    this.treeValue.set(val ?? emptySelection());
    this.stateTrigger.update((v) => v + 1);
  }

  public registerOnChange(fn: (value: ErpTreeSelectionValue | null) => void): void {
    this._onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.internalControl.disable({ emitEvent: false }) : this.internalControl.enable({ emitEvent: false });
  }
}
