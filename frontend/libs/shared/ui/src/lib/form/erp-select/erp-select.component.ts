import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  input,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { noop } from 'rxjs';
import {
  TuiTextfieldComponent,
  TuiTextfieldOptionsDirective,
  TuiInputDirective,
  TuiLabel,
  TuiIcon,
  TuiErrorComponent,
  TuiDropdown,
  TuiDropdownOpen,
  TuiDataList,
  TuiOption,
} from '@taiga-ui/core';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { TuiChip, TuiHighlight } from '@taiga-ui/kit';
import { PolymorpheusOutlet } from '@taiga-ui/polymorpheus';

import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpSelectConfig, ErpSelectStrategy } from './erp-select.types';

@Component({
  selector: 'erp-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ScrollingModule,
    NgComponentOutlet,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiInputDirective,
    TuiLabel,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    TuiDropdown,
    TuiDropdownOpen,
    TuiDataList,
    TuiOption,
    TuiChip,
    TuiHighlight,
    PolymorpheusOutlet,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpSelectComponent),
      multi: true,
    },
  ],
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || '';
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';

    <div class="erp-select-wrapper">
      <tui-textfield
        [tuiTextfieldSize]="_size()"
        [tuiTextfieldCleaner]="false"
        [tuiDropdown]="_dropdownTemplate"
        [tuiDropdownOpen]="dropdownOpen()"
        (tuiDropdownOpenChange)="onDropdownOpenChange($event)"
        class="erp-select-textfield"
      >
        @if (labelText) {
          <label tuiLabel>{{ labelText }}</label>
        }

        <!-- Single selection input display -->
        @if (_strategy() === 'single') {
          <input
            #inputElement
            tuiInput
            type="text"
            [readonly]="!_searchable()"
            [placeholder]="placeholderText"
            [value]="singleInputValue()"
            [invalid]="_invalid()"
            (input)="onSearchInput($event)"
            (click)="onInputClick()"
            (blur)="onBlur()"
          />
        } @else {
          <!-- Multi selection input display -->
          <div
            class="erp-select-multi-container"
            [class.erp-select-multi-container--no-label]="!labelText"
          >
            @if (showSummaryText()) {
              <span class="erp-select-summary-text">
                {{ summaryText() }}
              </span>
            } @else {
              @for (item of selectedMultiItems(); track getItemTrackBy(item)) {
                <span tuiChip class="erp-select-chip" size="s">
                  {{ getItemString(item) }}
                  <tui-icon
                    icon="@tui.x"
                    class="erp-select-chip-remove"
                    (click)="$event.stopPropagation(); removeMultiItem(item)"
                  />
                </span>
              }
            }

            <input
              #inputElement
              tuiInput
              type="text"
              [readonly]="!_searchable()"
              [placeholder]="selectedMultiItems().length === 0 ? placeholderText : ''"
              [value]="multiInputValue()"
              [invalid]="_invalid()"
              [class.erp-select-searchable-multi-input]="_searchable()"
              [class.erp-select-invisible-input]="!_searchable()"
              (input)="onSearchInput($event)"
              (click)="onInputClick()"
              (blur)="onBlur()"
            />
          </div>
        }

        @if (showGlobalCleaner()) {
          <tui-icon
            icon="@tui.x"
            class="erp-select-cleaner"
            (click)="$event.stopPropagation(); clearValue($event)"
          />
        }

        <tui-icon icon="@tui.chevron-down" class="erp-select-arrow" />

        @if (_tooltip() && tooltipText) {
          <tui-icon icon="@tui.circle-help" [tuiHint]="tooltipText" />
        }
      </tui-textfield>

      @if (errorText) {
        <tui-error
          [error]="errorText"
          [class.erp-shake]="shake()"
          (animationend)="onShakeEnd($event)"
        />
      }

      @if (hintText) {
        <div class="erp-select-hint">{{ hintText }}</div>
      }
    </div>

    <!-- Dropdown Content Template -->
    <ng-template #_dropdownTemplate>
      <div class="erp-select-dropdown-container">
        <!-- Optional List Header -->
        @if (_headerContent()) {
          <div class="erp-select-header">
            <ng-container *polymorpheusOutlet="_headerContent() as content">
              {{ content }}
            </ng-container>
          </div>
        }

        <tui-data-list
          class="erp-select-datalist"
          [class.erp-select-datalist--virtual]="_virtualScroll()"
        >
          @if (_virtualScroll()) {
            <cdk-virtual-scroll-viewport
              [itemSize]="_itemSize()"
              class="erp-select-virtual-viewport"
            >
              <button
                *cdkVirtualFor="let item of filteredItems(); trackBy: trackByFn"
                tuiOption
                type="button"
                [attr.data-selected]="isItemSelected(item)"
                class="erp-select-option"
                [style.height.px]="_itemSize()"
                (click)="onSelectOption(item)"
              >
                <ng-container *ngTemplateOutlet="_optionItemTpl; context: { $implicit: item }" />
              </button>
            </cdk-virtual-scroll-viewport>
          } @else {
            @for (item of filteredItems(); track getItemTrackBy(item)) {
              <button
                tuiOption
                type="button"
                [attr.data-selected]="isItemSelected(item)"
                class="erp-select-option"
                (click)="onSelectOption(item)"
              >
                <ng-container *ngTemplateOutlet="_optionItemTpl; context: { $implicit: item }" />
              </button>
            }
          }

          @if (filteredItems().length === 0) {
            <div class="erp-select-empty">
              Brak wyników
            </div>
          }
        </tui-data-list>
      </div>
    </ng-template>

    <!-- Option Item Content Template -->
    <ng-template #_optionItemTpl let-item>
      <div class="erp-select-option-content">
        @if (_strategy() === 'multi') {
          <tui-icon
            [icon]="isItemSelected(item) ? '@tui.square-check' : '@tui.square'"
            class="erp-select-checkbox-icon"
          />
        }

        @if (_itemComponent()) {
          <ng-container *ngComponentOutlet="_itemComponent()!; inputs: { item: item }" />
        } @else if (_itemContent()) {
          <ng-container *polymorpheusOutlet="_itemContent() as content; context: { $implicit: item }">
            {{ content }}
          </ng-container>
        } @else {
          <span
            tuiHighlight
            class="erp-select-option-label"
            [tuiHighlight]="searchQuery()"
            [tuiHighlightColor]="'var(--tui-background-accent-2, #fef08a)'"
          >
            {{ getItemString(item) }}
          </span>
        }

        @if (_strategy() === 'single' && isItemSelected(item)) {
          <tui-icon icon="@tui.check" class="erp-select-check-icon" />
        }
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      @keyframes erp-form-shake {
        0%,
        100% {
          transform: translateX(0);
        }
        15%,
        45%,
        75% {
          transform: translateX(-4px);
        }
        30%,
        60%,
        90% {
          transform: translateX(4px);
        }
      }

      .erp-shake {
        animation: erp-form-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
      }

      .erp-select-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .erp-select-textfield {
        cursor: pointer;
      }

      .erp-select-multi-container {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
        width: 100%;
        min-height: 1.5rem;
        margin-top: 1rem;
        padding-bottom: 0.25rem;
      }

      .erp-select-multi-container--no-label {
        margin-top: 0;
      }

      .erp-select-searchable-multi-input {
        border: none !important;
        background: transparent !important;
        outline: none !important;
        min-width: 4rem;
        flex: 1 1 auto;
        font-size: 0.875rem;
        color: var(--tui-text-primary);
        padding: 0 !important;
      }

      .erp-select-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .erp-select-chip-remove {
        font-size: 0.875rem;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.15s;
      }

      .erp-select-chip-remove:hover {
        opacity: 1;
      }

      .erp-select-summary-text {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--tui-text-primary);
      }

      .erp-select-placeholder {
        color: var(--tui-text-tertiary);
        font-size: 0.875rem;
      }

      .erp-select-invisible-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 0;
        height: 0;
      }

      .erp-select-cleaner {
        color: var(--tui-text-tertiary);
        cursor: pointer;
        transition: color 0.15s;
        margin-inline-start: auto;
      }

      .erp-select-cleaner:hover {
        color: var(--tui-text-primary);
      }

      .erp-select-arrow {
        color: var(--tui-text-secondary);
      }

      .erp-select-hint {
        font: var(--tui-typography-body-xs);
        color: var(--tui-text-secondary);
        margin-top: 0.125rem;
      }

      tui-error {
        font: var(--tui-typography-body-xs);
      }

      .erp-select-dropdown-container {
        min-width: 12rem;
        background: var(--tui-background-elevation-1);
        border-radius: var(--tui-radius-m);
        box-shadow: var(--tui-shadow-m);
        overflow: hidden;
      }

      .erp-select-header {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--tui-border-normal);
        font-weight: 600;
        font-size: 0.875rem;
      }

      .erp-select-datalist {
        max-height: 18rem;
        overflow-y: auto;
      }

      .erp-select-datalist--virtual {
        max-height: none !important;
        overflow: hidden !important;
        padding: 0 !important;
      }

      .erp-select-virtual-viewport {
        height: 16rem !important;
        width: 100%;
        outline: none;
      }

      .erp-select-option {
        width: 100%;
        text-align: left;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }

      .erp-select-option[data-selected='true'] {
        background-color: var(--tui-background-neutral-1-hover);
        font-weight: 600;
      }

      .erp-select-option-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
      }

      .erp-select-option-label {
        position: relative;
        display: inline-block;
        z-index: 1;
      }

      .erp-select-checkbox-icon {
        color: var(--tui-text-action);
      }

      .erp-select-check-icon {
        margin-inline-start: auto;
        color: var(--tui-text-action);
      }

      .erp-select-empty {
        padding: 0.75rem;
        text-align: center;
        color: var(--tui-text-tertiary);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class ErpSelectComponent<T = unknown> implements ControlValueAccessor {
  readonly config = input.required<ErpSelectConfig<T>>();
  readonly control = input<FormControl | null>(null);

  @ViewChild(CdkVirtualScrollViewport) protected viewport?: CdkVirtualScrollViewport;
  @ViewChild('inputElement') protected inputElement?: ElementRef<HTMLInputElement>;

  readonly internalControl = new FormControl();
  readonly activeControl = computed(() => this.control() || this.internalControl);

  protected readonly dropdownOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly isSearchActive = signal(false);
  protected readonly shake = signal<boolean>(false);
  private readonly stateTrigger = signal(0);
  private lastValueChangeTime = 0;
  private lastShakeTime = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _onChange: (value: any) => void = noop;
  protected onTouched: () => void = noop;

  constructor() {
    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.activeControl().setValue(configVal, { emitEvent: false });
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
      const sub1 = ctrl.valueChanges.subscribe((val) => {
        this.lastValueChangeTime = Date.now();
        this.stateTrigger.update((v) => v + 1);
        if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
          this.searchQuery.set('');
          this.isSearchActive.set(false);
        }
      });
      const sub2 = ctrl.statusChanges.subscribe(() => {
        this.stateTrigger.update((v) => v + 1);
        const isTyping = Date.now() - this.lastValueChangeTime < 50;
        if (!isTyping && this._invalid()) {
          this.triggerShakeIfInvalid();
        }
      });

      const originalMarkAsTouched = ctrl.markAsTouched.bind(ctrl);
      const originalMarkAllAsTouched = ctrl.markAllAsTouched.bind(ctrl);

      ctrl.markAsTouched = (opts?: { onlySelf?: boolean }) => {
        originalMarkAsTouched(opts);
        this.stateTrigger.update((v) => v + 1);
        this.triggerShakeIfInvalid();
      };
      ctrl.markAllAsTouched = () => {
        originalMarkAllAsTouched();
        this.stateTrigger.update((v) => v + 1);
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
  }

  protected onDropdownOpenChange(open: boolean): void {
    if (unwrapSignal(this.config().disabled)) {
      return;
    }
    this.dropdownOpen.set(open);
    if (open) {
      if (this._virtualScroll()) {
        setTimeout(() => {
          this.viewport?.checkViewportSize();
          this.viewport?.scrollToIndex(0);
        }, 50);
      }
    } else {
      this.searchQuery.set('');
      this.isSearchActive.set(false);
    }
  }

  protected onInputClick(): void {
    if (!this.dropdownOpen() && !unwrapSignal(this.config().disabled)) {
      this.onDropdownOpenChange(true);
    }
  }

  protected clearValue(event?: Event): void {
    event?.stopPropagation();
    const emptyVal = this._strategy() === 'multi' ? [] : null;
    this.activeControl().setValue(emptyVal);
    this._onChange(emptyVal);
    this.searchQuery.set('');
    this.isSearchActive.set(false);

    setTimeout(() => {
      this.inputElement?.nativeElement?.focus();
      this.onDropdownOpenChange(true);
    }, 0);
  }

  protected onSearchInput(event: Event): void {
    if (!this._searchable()) {
      return;
    }
    const val = (event.target as HTMLInputElement).value;
    if (val === '') {
      this.clearValue(event);
      return;
    }
    this.searchQuery.set(val);
    this.isSearchActive.set(true);
    if (!this.dropdownOpen()) {
      this.onDropdownOpenChange(true);
    }
  }

  // Computed Config Accessors
  protected readonly _items = computed(() => unwrapSignal(this.config().items) ?? []);
  protected readonly _strategy = computed<ErpSelectStrategy>(
    () => unwrapSignal(this.config().strategy) ?? 'single'
  );
  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _stringify = computed(
    () => unwrapSignal(this.config().stringify) ?? ((item: T) => (item != null ? String(item) : ''))
  );
  protected readonly _identityMatcher = computed(
    () => unwrapSignal(this.config().identityMatcher) ?? ((a: T, b: T) => a === b)
  );
  protected readonly _maxChipsCount = computed(() => unwrapSignal(this.config().maxChipsCount) ?? 3);
  protected readonly _summaryFormatter = computed(() => unwrapSignal(this.config().summaryFormatter));
  protected readonly _headerContent = computed(() => unwrapSignal(this.config().headerContent));
  protected readonly _itemContent = computed(() => unwrapSignal(this.config().itemContent));
  protected readonly _itemComponent = computed(() => unwrapSignal(this.config().itemComponent));
  protected readonly _virtualScroll = computed(() => unwrapSignal(this.config().virtualScroll) ?? false);
  protected readonly _itemSize = computed(() => unwrapSignal(this.config().itemSize) ?? 44);
  protected readonly _searchable = computed(() => unwrapSignal(this.config().searchable) ?? false);

  // Filtered items based on search query
  protected readonly filteredItems = computed(() => {
    const items = this._items();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return items;
    }
    const stringifier = this._stringify();
    return items.filter((item) => stringifier(item).toLowerCase().includes(query));
  });

  // Selected values for single & multi
  protected readonly currentRawValue = computed(() => {
    this.stateTrigger();
    return this.activeControl().value;
  });

  protected readonly selectedMultiItems = computed<T[]>(() => {
    const val = this.currentRawValue();
    if (Array.isArray(val)) {
      return val;
    }
    return val != null ? [val] : [];
  });

  protected readonly singleDisplayValue = computed(() => {
    const val = this.currentRawValue();
    if (val == null || val === '') {
      return '';
    }
    return this.getItemString(val);
  });

  protected readonly singleInputValue = computed(() => {
    if (this.isSearchActive()) {
      return this.searchQuery();
    }
    return this.singleDisplayValue();
  });

  protected readonly multiInputValue = computed(() => {
    if (this.isSearchActive()) {
      return this.searchQuery();
    }
    if (this.selectedMultiItems().length > 0) {
      return ' ';
    }
    return '';
  });

  protected readonly hasSelectedValue = computed(() => {
    if (this._strategy() === 'single') {
      const val = this.currentRawValue();
      return val != null && val !== '';
    }
    return this.selectedMultiItems().length > 0;
  });

  protected readonly showGlobalCleaner = computed(() => {
    return this.hasSelectedValue();
  });

  protected readonly showSummaryText = computed(() => {
    if (this._strategy() !== 'multi') {
      return false;
    }
    const count = this.selectedMultiItems().length;
    return count > this._maxChipsCount();
  });

  protected readonly summaryText = computed(() => {
    const count = this.selectedMultiItems().length;
    const customFormatter = this._summaryFormatter();
    if (customFormatter) {
      return customFormatter(count);
    }
    return `Wybranych elementów (${count})`;
  });

  protected getItemString(item: T): string {
    if (item == null) {
      return '';
    }
    return this._stringify()(item);
  }

  protected isItemSelected(item: T): boolean {
    const matcher = this._identityMatcher();
    const val = this.currentRawValue();
    if (this._strategy() === 'single') {
      return val != null && matcher(val as T, item);
    }
    const selectedList = this.selectedMultiItems();
    return selectedList.some((selected) => matcher(selected, item));
  }

  protected onSelectOption(item: T): void {
    const matcher = this._identityMatcher();
    if (this._strategy() === 'single') {
      this.activeControl().setValue(item);
      this._onChange(item);
      this.searchQuery.set('');
      this.isSearchActive.set(false);
      this.dropdownOpen.set(false);
    } else {
      const current = [...this.selectedMultiItems()];
      const index = current.findIndex((selected) => matcher(selected, item));
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(item);
      }
      this.activeControl().setValue(current);
      this._onChange(current);
      this.searchQuery.set('');
    }
  }

  protected removeMultiItem(item: T): void {
    const matcher = this._identityMatcher();
    const current = [...this.selectedMultiItems()];
    const index = current.findIndex((selected) => matcher(selected, item));
    if (index >= 0) {
      current.splice(index, 1);
      this.activeControl().setValue(current);
      this._onChange(current);
    }

    setTimeout(() => {
      this.inputElement?.nativeElement?.focus();
      this.onDropdownOpenChange(true);
    }, 0);
  }

  protected getItemTrackBy(item: T): string | T {
    const stringifier = this._stringify();
    return item != null ? stringifier(item) : item;
  }

  protected trackByFn = (index: number, item: T): string | T => {
    return this.getItemTrackBy(item);
  };

  protected triggerShakeIfInvalid(): void {
    if (!this._invalid()) {
      return;
    }
    const now = Date.now();
    if (now - this.lastShakeTime < 100) {
      return;
    }
    this.lastShakeTime = now;

    if (this.shake()) {
      this.shake.set(false);
      setTimeout(() => this.shake.set(true), 10);
    } else {
      this.shake.set(true);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected onShakeEnd(event: any): void {
    if (event?.animationName === 'erp-form-shake') {
      this.shake.set(false);
    }
  }

  protected onBlur(): void {
    this.onTouched();
    this.stateTrigger.update((v) => v + 1);
  }

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

  // ControlValueAccessor methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.internalControl.disable({ emitEvent: false });
    } else {
      this.internalControl.enable({ emitEvent: false });
    }
  }
}
