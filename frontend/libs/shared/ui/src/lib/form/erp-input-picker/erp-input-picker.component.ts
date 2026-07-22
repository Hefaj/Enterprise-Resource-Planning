import { NgTemplateOutlet } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
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
import { TranslocoService } from '@jsverse/transloco';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  TuiTextfield,
  TuiLabel,
  TuiErrorComponent,
  TuiDropdown,
  TuiDataList,
  TuiFilterByInputPipe,
  TuiLoader,
  type TuiItemsHandlers,
  TUI_ITEMS_HANDLERS,
} from '@taiga-ui/core';
import {
  TuiComboBoxDirective,
  TuiInputChipDirective,
  TuiMultiSelectGroupDirective,
} from '@taiga-ui/kit';
import { TuiChevron } from '@taiga-ui/kit/directives/chevron';
import {
  type TuiStringHandler,
  TUI_DEFAULT_IDENTITY_MATCHER,
  TUI_FALSE_HANDLER,
  TuiItem,
} from '@taiga-ui/cdk';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpInputPickerConfig } from './erp-input-picker.types';
import { noop, Subject, isObservable, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'erp-input-picker',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ScrollingModule,
    ReactiveFormsModule,
    TuiTextfield,
    TuiLabel,
    TuiErrorComponent,
    TuiDropdown,
    TuiDataList,
    TuiFilterByInputPipe,
    TuiLoader,
    TuiComboBoxDirective,
    TuiInputChipDirective,
    TuiMultiSelectGroupDirective,
    TuiChevron,
    TuiItem,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpInputPickerComponent),
      multi: true,
    },
    {
      provide: TUI_ITEMS_HANDLERS,
      useExisting: forwardRef(() => ErpInputPickerComponent),
    },
  ],
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || (_searchPlaceholder() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';
    @let emptyText = (_emptyContent() | erpTranslate) || (SHARED_KEYS.inputPicker.empty | erpTranslate) || '';

    <div class="erp-input-picker-wrapper">
      @if (_isMulti()) {
        <tui-textfield
          multi
          tuiChevron
          [tuiTextfieldSize]="_size()"
          [tuiTextfieldCleaner]="hasMultiValue()"
          [class.erp-collapsed-multi]="isMultiCollapsed()"
          (openChange)="onDropdownOpenChange($event)"
        >
          @let filteredItems = isAsync() ? renderedItems() : (_items() | tuiFilterByInput);
          @if (labelText) {
            <label tuiLabel>{{ labelText }}</label>
          }
          <ng-template tuiItem let-ctx>
            @if (isMultiCollapsed()) {
              @if (ctx.index === 0) {
                <span class="erp-collapsed-chip">{{ SHARED_KEYS.inputPicker.selectedCount | erpTranslate: { count: selectedMultiCount() } }}</span>
              }
            } @else {
              <span>{{ stringifyHandler(ctx.item) }}{{ ctx.index < selectedMultiCount() - 1 ? ', ' : '' }}</span>
            }
          </ng-template>
          <input
            tuiInputChip
            [formControl]="multiControl"
            [placeholder]="placeholderText"
            [invalid]="_invalid()"
            (blur)="onBlur()"
            (input)="onSearchInput($event)"
          />
          @if (_virtualScroll(); as itemSize) {
            <tui-data-list
              *tuiDropdown
              tuiMultiSelectGroup
              [size]="_size()"
              [emptyContent]="emptyText"
              (scroll)="onDataListScroll($event)"
            >
              @if (internalLoading() && filteredItems.length === 0) {
                <div class="erp-picker-loader-container">
                  <tui-loader size="m" />
                </div>
              } @else if (filteredItems.length === 0) {
                <span class="erp-empty-item">{{ emptyText }}</span>
              } @else {
                <cdk-virtual-scroll-viewport
                  [itemSize]="itemSize"
                  [style.height.px]="getViewportHeight(filteredItems.length, itemSize)"
                  class="erp-virtual-scroll-viewport"
                  (scrolledIndexChange)="onVirtualScrollIndexChange($event, filteredItems.length)"
                >
                  <button
                    *cdkVirtualFor="let item of filteredItems"
                    tuiOption
                    type="button"
                    [value]="item"
                  >
                    <ng-container *ngTemplateOutlet="itemContentTemplate; context: { $implicit: item }" />
                  </button>
                </cdk-virtual-scroll-viewport>
                @if (loadingMore()) {
                  <div class="erp-picker-loader-footer">
                    <tui-loader size="s" />
                    <span>{{ SHARED_KEYS.inputPicker.loadingMore | erpTranslate }}</span>
                  </div>
                }
              }
            </tui-data-list>
          } @else {
            <tui-data-list
              *tuiDropdown
              tuiMultiSelectGroup
              [size]="_size()"
              [emptyContent]="emptyText"
              (scroll)="onDataListScroll($event)"
            >
              @if (internalLoading() && filteredItems.length === 0) {
                <div class="erp-picker-loader-container">
                  <tui-loader size="m" />
                </div>
              } @else if (filteredItems.length === 0) {
                <span class="erp-empty-item">{{ emptyText }}</span>
              } @else {
                @for (item of filteredItems; track getReturnValue(item)) {
                  <button
                    tuiOption
                    type="button"
                    [value]="item"
                  >
                    <ng-container *ngTemplateOutlet="itemContentTemplate; context: { $implicit: item }" />
                  </button>
                }
                @if (loadingMore()) {
                  <div class="erp-picker-loader-footer">
                    <tui-loader size="s" />
                    <span>{{ SHARED_KEYS.inputPicker.loadingMore | erpTranslate }}</span>
                  </div>
                }
              }
            </tui-data-list>
          }
        </tui-textfield>
      } @else {
        <tui-textfield
          tuiChevron
          [tuiTextfieldSize]="_size()"
          [tuiTextfieldCleaner]="hasSingleValue()"
          (openChange)="onDropdownOpenChange($event)"
        >
          @let filteredItems = isAsync() ? renderedItems() : (_items() | tuiFilterByInput);
          @if (labelText) {
            <label tuiLabel>{{ labelText }}</label>
          }
          <input
            tuiComboBox
            type="text"
            [formControl]="comboControl"
            [placeholder]="placeholderText"
            [invalid]="_invalid()"
            [strict]="_strict()"
            (blur)="onBlur()"
            (input)="onSearchInput($event)"
          />
          @if (_virtualScroll(); as itemSize) {
            <tui-data-list
              *tuiDropdown
              [size]="_size()"
              [emptyContent]="emptyText"
              (scroll)="onDataListScroll($event)"
            >
              @if (internalLoading() && filteredItems.length === 0) {
                <div class="erp-picker-loader-container">
                  <tui-loader size="m" />
                </div>
              } @else if (filteredItems.length === 0) {
                <span class="erp-empty-item">{{ emptyText }}</span>
              } @else {
                <cdk-virtual-scroll-viewport
                  [itemSize]="itemSize"
                  [style.height.px]="getViewportHeight(filteredItems.length, itemSize)"
                  class="erp-virtual-scroll-viewport"
                  (scrolledIndexChange)="onVirtualScrollIndexChange($event, filteredItems.length)"
                >
                  <button
                    *cdkVirtualFor="let item of filteredItems"
                    tuiOption
                    type="button"
                    [value]="item"
                  >
                    <ng-container *ngTemplateOutlet="itemContentTemplate; context: { $implicit: item }" />
                  </button>
                </cdk-virtual-scroll-viewport>
                @if (loadingMore()) {
                  <div class="erp-picker-loader-footer">
                    <tui-loader size="s" />
                    <span>{{ SHARED_KEYS.inputPicker.loadingMore | erpTranslate }}</span>
                  </div>
                }
              }
            </tui-data-list>
          } @else {
            <tui-data-list
              *tuiDropdown
              [size]="_size()"
              [emptyContent]="emptyText"
              (scroll)="onDataListScroll($event)"
            >
              @if (internalLoading() && filteredItems.length === 0) {
                <div class="erp-picker-loader-container">
                  <tui-loader size="m" />
                </div>
              } @else if (filteredItems.length === 0) {
                <span class="erp-empty-item">{{ emptyText }}</span>
              } @else {
                @for (item of filteredItems; track getReturnValue(item)) {
                  <button
                    tuiOption
                    type="button"
                    [value]="item"
                  >
                    <ng-container *ngTemplateOutlet="itemContentTemplate; context: { $implicit: item }" />
                  </button>
                }
                @if (loadingMore()) {
                  <div class="erp-picker-loader-footer">
                    <tui-loader size="s" />
                    <span>{{ SHARED_KEYS.inputPicker.loadingMore | erpTranslate }}</span>
                  </div>
                }
              }
            </tui-data-list>
          }
        </tui-textfield>
      }

      <ng-template #itemContentTemplate let-item>
        <span class="erp-input-picker-item">{{ getDisplayString(item) }}</span>
      </ng-template>

      @if (errorText) {
        <tui-error [error]="errorText" [class.erp-shake]="shake()" (animationend)="onShakeEnd($event)" />
      }

      @if (hintText) {
        <div class="erp-input-picker-hint">{{ hintText }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    @keyframes erp-form-shake {
      0%, 100% {
        transform: translateX(0);
      }
      15%, 45%, 75% {
        transform: translateX(-4px);
      }
      30%, 60%, 90% {
        transform: translateX(4px);
      }
    }

    .erp-shake {
      animation: erp-form-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }

    .erp-input-picker-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .erp-collapsed-multi ::ng-deep tui-textfield-item:not(:first-of-type) {
      display: none !important;
    }

    .erp-collapsed-chip {
      display: inline-block;
      font-weight: 500;
      white-space: nowrap;
    }

    .erp-input-picker-hint {
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    .erp-input-picker-item {
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .erp-virtual-scroll-viewport {
      width: 100%;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .erp-virtual-scroll-viewport button[tuiOption] {
      width: 100%;
    }

    .erp-empty-item {
      display: block;
      padding: 0.5rem 0.75rem;
      font: var(--tui-typography-body-s);
      color: var(--tui-text-tertiary);
    }

    .erp-picker-loader-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.25rem;
      width: 100%;
    }

    .erp-picker-loader-footer {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
      border-top: 1px solid var(--tui-border-normal-subtle, rgba(0, 0, 0, 0.08));
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpInputPickerComponent implements ControlValueAccessor, TuiItemsHandlers<any> {
  private readonly transloco = inject(TranslocoService, { optional: true });
  protected readonly SHARED_KEYS = SHARED_KEYS;

  readonly config = input.required<ErpInputPickerConfig>();
  readonly control = input<FormControl | null>(null);

  readonly internalControl = new FormControl();
  readonly activeControl = computed(() => this.control() || this.internalControl);

  readonly comboControl = new FormControl<any | null>(null);
  readonly multiControl = new FormControl<any[]>([]);

  readonly stringify = computed(() => this.stringifyHandler);
  readonly identityMatcher = signal(TUI_DEFAULT_IDENTITY_MATCHER);
  readonly disabledItemHandler = signal(TUI_FALSE_HANDLER);

  protected readonly shake = signal<boolean>(false);
  protected readonly internalLoading = signal<boolean>(false);
  protected readonly loadingMore = signal<boolean>(false);
  protected readonly asyncItems = signal<any[]>([]);
  protected readonly currentPage = signal<number>(0);
  protected readonly hasMorePages = signal<boolean>(true);
  private readonly itemCache = new Map<any, any>();
  private readonly searchSubject = new Subject<string>();
  private readonly currentSearchQuery = signal<string>('');

  private readonly stateTrigger = signal(0);
  private lastValueChangeTime = 0;
  private lastShakeTime = 0;
  private isUpdatingFromModel = false;

  private _onChange: (value: any) => void = noop;
  protected onTouched: () => void = noop;

  constructor() {
    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.activeControl().setValue(configVal, { emitEvent: false });
          this.stateTrigger.update(v => v + 1);
        });
      }
    });

    effect(() => {
      const isDisabled = unwrapSignal(this.config().disabled);
      untracked(() => {
        if (isDisabled) {
          this.activeControl().disable({ emitEvent: false });
          this.comboControl.disable({ emitEvent: false });
          this.multiControl.disable({ emitEvent: false });
        } else {
          this.activeControl().enable({ emitEvent: false });
          this.comboControl.enable({ emitEvent: false });
          this.multiControl.enable({ emitEvent: false });
        }
        this.stateTrigger.update(v => v + 1);
      });
    });

    effect(() => {
      const currentItems = this.renderedItems();
      const isMulti = this._isMulti();
      const ctrl = untracked(() => this.activeControl());
      const activeVal = ctrl.value;

      untracked(() => {
        this.syncToView(activeVal, currentItems, isMulti);
      });
    });

    effect((onCleanup) => {
      const ctrl = this.activeControl();
      const sub1 = ctrl.valueChanges.subscribe((val) => {
        this.lastValueChangeTime = Date.now();
        this.syncToView(val, this.renderedItems(), this._isMulti());
      });
      const sub2 = ctrl.statusChanges.subscribe(() => {
        this.stateTrigger.update(v => v + 1);
        const isTyping = (Date.now() - this.lastValueChangeTime) < 50;
        if (!isTyping && this._invalid()) {
          this.triggerShakeIfInvalid();
        }
      });

      const originalMarkAsTouched = ctrl.markAsTouched.bind(ctrl);
      const originalMarkAllAsTouched = ctrl.markAllAsTouched.bind(ctrl);

      ctrl.markAsTouched = (opts?: { onlySelf?: boolean }) => {
        originalMarkAsTouched(opts);
        this.stateTrigger.update(v => v + 1);
        this.triggerShakeIfInvalid();
      };
      ctrl.markAllAsTouched = () => {
        originalMarkAllAsTouched();
        this.stateTrigger.update(v => v + 1);
        this.triggerShakeIfInvalid();
      };

      onCleanup(() => {
        sub1.unsubscribe();
        sub2.unsubscribe();
        ctrl.markAsTouched = originalMarkAsTouched;
        ctrl.markAllAsTouched = originalMarkAllAsTouched;
      });
    });

    this.internalControl.valueChanges.subscribe((val) => {
      this._onChange(val);
    });

    this.comboControl.valueChanges.subscribe((selectedItem) => {
      if (this.isUpdatingFromModel) return;
      if (selectedItem === null || selectedItem === undefined || selectedItem === '') {
        this.updateActiveValue(null);
      } else if (typeof selectedItem === 'string' && !this.renderedItems().includes(selectedItem as any)) {
        const matched = this.renderedItems().find(i => this.getDisplayString(i) === selectedItem || this.getReturnValue(i) === selectedItem);
        if (matched) {
          this.updateActiveValue(this.getReturnValue(matched));
        } else {
          this.updateActiveValue(selectedItem);
        }
      } else {
        this.updateActiveValue(this.getReturnValue(selectedItem));
      }
    });

    this.multiControl.valueChanges.subscribe((selectedItems) => {
      if (this.isUpdatingFromModel) return;
      const list = Array.isArray(selectedItems) ? selectedItems : [];
      const returnValues = list.map(item => this.getReturnValue(item));
      this.updateActiveValue(returnValues);
    });
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (this.isAsync()) {
        this.currentSearchQuery.set(query);
        this.currentPage.set(0);
        this.hasMorePages.set(true);
        this.performSearch(query, 0, false);
      }
    });
  }

  protected syncToView(activeVal: any, currentItems: readonly any[], isMulti: boolean): void {
    this.isUpdatingFromModel = true;
    try {
      if (this.isAsync() && activeVal !== null && activeVal !== undefined && activeVal !== '') {
        const valArray = isMulti
          ? (Array.isArray(activeVal) ? activeVal : [activeVal])
          : [activeVal];
        const missingIds = valArray.filter(id => (typeof id === 'string' || typeof id === 'number') && !this.itemCache.has(id));
        if (missingIds.length > 0) {
          this.resolveMissingAsyncIds(missingIds);
        }
      }

      if (isMulti) {
        const valArray = Array.isArray(activeVal) ? activeVal : (activeVal !== null && activeVal !== undefined ? [activeVal] : []);
        const matched = currentItems.filter(item => {
          const retVal = this.getReturnValue(item);
          return valArray.some(v => v === retVal || (typeof v === 'object' && v !== null && typeof retVal === 'object' && retVal !== null && JSON.stringify(v) === JSON.stringify(retVal)));
        });
        this.multiControl.setValue(matched, { emitEvent: false });
      } else {
        if (activeVal === null || activeVal === undefined || activeVal === '') {
          this.comboControl.setValue(null, { emitEvent: false });
        } else {
          const matched = currentItems.find(item => {
            const retVal = this.getReturnValue(item);
            return activeVal === retVal || (typeof activeVal === 'object' && activeVal !== null && typeof retVal === 'object' && retVal !== null && JSON.stringify(activeVal) === JSON.stringify(retVal));
          });
          this.comboControl.setValue(matched ?? activeVal, { emitEvent: false });
        }
      }
    } finally {
      this.isUpdatingFromModel = false;
      this.stateTrigger.update(v => v + 1);
    }
  }

  protected updateActiveValue(val: any): void {
    this.lastValueChangeTime = Date.now();
    const ctrl = this.activeControl();
    ctrl.markAsDirty();
    ctrl.markAsTouched();
    ctrl.setValue(val);
    this._onChange(val);
    this.onTouched();
    this.stateTrigger.update(v => v + 1);
    if (this._invalid()) {
      this.triggerShakeIfInvalid();
    }
  }

  public getDisplayString(item: any): string {
    if (item === null || item === undefined) return '';
    const extractor = this._displayExtractor();
    if (extractor) {
      return extractor(item);
    }
    const key = this._labelKey();
    if (key && typeof item === 'object' && key in item) {
      return String(item[key as keyof typeof item] ?? '');
    }
    return typeof item === 'object' && item !== null ? (item.label || item.name || JSON.stringify(item)) : String(item);
  }

  public getReturnValue(item: any): any {
    if (item === null || item === undefined) return null;
    const extractor = this._valueExtractor();
    if (extractor) {
      return extractor(item);
    }
    const key = this._valueKey();
    if (key && typeof item === 'object' && key in item) {
      return item[key as keyof typeof item];
    }
    return item;
  }

  protected readonly stringifyHandler: TuiStringHandler<any> = (item: any) => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' && !this.renderedItems().some(i => i === item)) {
      const matched = this.renderedItems().find(i => this.getDisplayString(i) === item);
      if (matched) return this.getDisplayString(matched);
      return item;
    }
    return this.getDisplayString(item);
  };

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

  protected onShakeEnd(event: any): void {
    if (event?.animationName === 'erp-form-shake') {
      this.shake.set(false);
    }
  }

  protected onBlur(): void {
    this.onTouched();
    this.activeControl().markAsTouched();
    this.stateTrigger.update(v => v + 1);
  }

  protected readonly _items = computed(() => unwrapSignal(this.config().items) ?? []);
  protected readonly _searchFn = computed(() => unwrapSignal(this.config().searchFn));
  protected readonly _getFn = computed(() => unwrapSignal(this.config().getFn));
  protected readonly _pageSize = computed(() => unwrapSignal(this.config().pageSize) ?? 50);
  protected readonly isAsync = computed(() => typeof this._searchFn() === 'function' && typeof this._getFn() === 'function');
  protected readonly renderedItems = computed(() => this.isAsync() ? this.asyncItems() : this._items());

  protected readonly _strategy = computed(() => unwrapSignal(this.config().strategy) ?? 'single');
  protected readonly _isMulti = computed(() => this._strategy() === 'multi');
  protected readonly _labelKey = computed(() => unwrapSignal(this.config().labelKey));
  protected readonly _valueKey = computed(() => unwrapSignal(this.config().valueKey));
  protected readonly _displayExtractor = computed(() => unwrapSignal(this.config().displayExtractor));
  protected readonly _valueExtractor = computed(() => unwrapSignal(this.config().valueExtractor));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _searchPlaceholder = computed(() => unwrapSignal(this.config().searchPlaceholder));
  protected readonly _emptyContent = computed(() => unwrapSignal(this.config().emptyContent));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _strict = computed(() => unwrapSignal(this.config().strict) ?? true);
  protected readonly _virtualScroll = computed(() => {
    const val = unwrapSignal(this.config().virtualScroll);
    if (typeof val === 'number') return val > 0 ? val : false;
    return val === true ? 36 : false;
  });

  protected readonly _maxCollapseCount = computed(() => {
    const val = unwrapSignal(this.config().maxCollapseCount);
    return typeof val === 'number' && val > 0 ? val : Infinity;
  });

  protected readonly selectedMultiCount = computed(() => {
    this.stateTrigger();
    const val = this.multiControl.value;
    return Array.isArray(val) ? val.length : 0;
  });

  protected readonly isMultiCollapsed = computed(() => {
    return this.selectedMultiCount() > this._maxCollapseCount();
  });

  protected getViewportHeight(itemCount: number, itemSize: number): number {
    return Math.min(itemCount * itemSize, 280);
  }

  protected readonly hasSingleValue = computed(() => {
    this.stateTrigger();
    const val = this.comboControl.value;
    return val !== null && val !== undefined && val !== '';
  });

  protected readonly hasMultiValue = computed(() => {
    this.stateTrigger();
    const val = this.multiControl.value;
    return Array.isArray(val) && val.length > 0;
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

  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
    this.syncToView(val, this.renderedItems(), this._isMulti());
  }

  public registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.internalControl.disable({ emitEvent: false });
      this.comboControl.disable({ emitEvent: false });
      this.multiControl.disable({ emitEvent: false });
    } else {
      this.internalControl.enable({ emitEvent: false });
      this.comboControl.enable({ emitEvent: false });
      this.multiControl.enable({ emitEvent: false });
    }
    this.stateTrigger.update(v => v + 1);
  }

  protected onSearchInput(event: Event): void {
    if (!this.isAsync()) return;
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchSubject.next(val);
  }

  protected onDropdownOpenChange(open: boolean): void {
    if (!open) {
      this.onTouched();
      this.activeControl().markAsTouched();
      this.stateTrigger.update(v => v + 1);
    }
    if (open && this.isAsync() && this.asyncItems().length === 0 && !this.internalLoading()) {
      this.currentPage.set(0);
      this.hasMorePages.set(true);
      this.performSearch(this.currentSearchQuery(), 0, false);
    }
  }

  protected onVirtualScrollIndexChange(index: number, totalLength: number): void {
    if (!this.isAsync() || !this.hasMorePages() || this.internalLoading() || this.loadingMore()) return;
    if (index + 20 >= totalLength) {
      this.loadNextPage();
    }
  }

  protected onDataListScroll(event: Event): void {
    if (!this.isAsync() || !this.hasMorePages() || this.internalLoading() || this.loadingMore()) return;
    const target = event.target as HTMLElement;
    if (target && target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      this.loadNextPage();
    }
  }

  protected loadNextPage(): void {
    if (!this.hasMorePages() || this.internalLoading() || this.loadingMore()) return;
    const nextPage = this.currentPage() + 1;
    this.currentPage.set(nextPage);
    this.performSearch(this.currentSearchQuery(), nextPage, true);
  }

  protected async performSearch(searchQuery: string, pageIndex: number, isLoadMore: boolean): Promise<void> {
    const searchFn = this._searchFn();
    const getFn = this._getFn();
    if (!searchFn || !getFn) return;

    if (isLoadMore) {
      this.loadingMore.set(true);
    } else {
      this.internalLoading.set(true);
    }

    try {
      const queryResult = searchFn({
        search: searchQuery,
        pageIndex,
        pageSize: this._pageSize(),
      });
      const rawResult = isObservable(queryResult) ? await firstValueFrom(queryResult) : await queryResult;
      const uuids: string[] = Array.isArray(rawResult) ? rawResult : (rawResult?.uuids ?? []);

      if (uuids.length < this._pageSize()) {
        this.hasMorePages.set(false);
      } else {
        this.hasMorePages.set(true);
      }

      if (uuids.length === 0) {
        if (pageIndex === 0) {
          this.asyncItems.set([]);
        }
        return;
      }

      const missingUuids = uuids.filter(id => !this.itemCache.has(id));
      if (missingUuids.length > 0) {
        const fetchedResult = getFn(missingUuids);
        const fetchedItems: any[] = isObservable(fetchedResult) ? await firstValueFrom(fetchedResult) : await fetchedResult;
        if (Array.isArray(fetchedItems)) {
          fetchedItems.forEach(item => {
            const key = this.getReturnValue(item);
            this.itemCache.set(key, item);
          });
        }
      }

      const pageItems = uuids.map(id => this.itemCache.get(id)).filter(item => item !== undefined);
      if (pageIndex === 0) {
        this.asyncItems.set(pageItems);
      } else {
        this.asyncItems.update(prev => [...prev, ...pageItems]);
      }
    } catch (err) {
      console.error('ErpInputPicker async search/get error:', err);
    } finally {
      if (isLoadMore) {
        this.loadingMore.set(false);
      } else {
        this.internalLoading.set(false);
      }
    }
  }

  private async resolveMissingAsyncIds(missingIds: any[]): Promise<void> {
    const getFn = this._getFn();
    if (!getFn || missingIds.length === 0) return;
    try {
      const fetchedResult = getFn(missingIds);
      const fetchedItems: any[] = isObservable(fetchedResult) ? await firstValueFrom(fetchedResult) : await fetchedResult;
      if (Array.isArray(fetchedItems)) {
        fetchedItems.forEach(item => {
          const key = this.getReturnValue(item);
          this.itemCache.set(key, item);
        });
        this.asyncItems.update(prev => {
          const existingKeys = new Set(prev.map(p => this.getReturnValue(p)));
          const newItems = fetchedItems.filter(f => !existingKeys.has(this.getReturnValue(f)));
          return [...prev, ...newItems];
        });
      }
    } catch (err) {
      console.error('ErpInputPicker resolveMissingAsyncIds error:', err);
    }
  }
}
