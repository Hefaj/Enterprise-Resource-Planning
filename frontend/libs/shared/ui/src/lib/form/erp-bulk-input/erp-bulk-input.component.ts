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
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiButtonX, TuiDropdown, TuiErrorComponent, TuiHintDirective, TuiIcon, TuiLabel, TuiTextfield } from '@taiga-ui/core';
import { TuiInputDirective } from '@taiga-ui/core/components/input';
import { TuiTextareaComponent } from '@taiga-ui/kit';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpDropdownMinWidthDirective } from '../../base/erp-dropdown-min-width.directive';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpBulkInputConfig } from './erp-bulk-input.types';
import { noop } from 'rxjs';

const SUMMARY_INLINE_LIMIT = 3;
/** Rozdziela wklejony tekst na pojedyncze wartości: nowa linia, tabulator, przecinek lub średnik. */
const SPLIT_PATTERN = /[\n\t,;]+/;

@Component({
  selector: 'erp-bulk-input',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfield,
    TuiInputDirective,
    TuiLabel,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    TuiButton,
    TuiButtonX,
    TuiDropdown,
    TuiTextareaComponent,
    ErpTranslatePipe,
    ErpDropdownMinWidthDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpBulkInputComponent),
      multi: true,
    },
  ],
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let values = currentValues();
    @let displayText = values.length === 0
      ? ''
      : values.length <= SUMMARY_INLINE_LIMIT
        ? values.join(', ')
        : (SHARED_KEYS.bulkInput.summaryCount | erpTranslate: { count: values.length });

    <div class="erp-bulk-input-wrapper">
      <tui-textfield
        erpDropdownMinWidth
        [tuiTextfieldSize]="'m'"
        [tuiTextfieldCleaner]="false"
        [open]="isOpen()"
        (openChange)="onDropdownOpenChange($event)"
      >
        @if (labelText) {
          <label tuiLabel>{{ labelText }}</label>
        }
        <input
          #hostInput
          tuiInput
          type="text"
          [readOnly]="true"
          [value]="displayText"
          [disabled]="_disabled()"
          [placeholder]="placeholderText"
          [invalid]="_invalid()"
        />
        @if (values.length > 0 && !_disabled()) {
          <button
            type="button"
            tuiButtonX
            tabindex="-1"
            (click)="clearAllValues()"
          >
            {{ SHARED_KEYS.bulkInput.clear | erpTranslate }}
          </button>
        }
        @if (tooltipText) {
          <tui-icon icon="@tui.circle-help" [tuiHint]="tooltipText" />
        }

        <div *tuiDropdown class="erp-bulk-input-panel">
          <textarea
            #rawTextarea
            tuiTextarea
            [formControl]="rawTextControl"
            [placeholder]="(SHARED_KEYS.bulkInput.textareaPlaceholder | erpTranslate) || ''"
            rows="6"
            (blur)="onTextareaBlur()"
            (keydown.escape)="onTextareaEscape()"
          ></textarea>
          <div class="erp-bulk-input-panel__footer">
            <span>{{ SHARED_KEYS.bulkInput.summaryCount | erpTranslate: { count: rawValuesCount() } }}</span>
            @if (rawValuesCount() > 0) {
              <button tuiButton type="button" appearance="flat" size="xs" (mousedown)="$event.preventDefault()" (click)="clearRawText()">
                {{ SHARED_KEYS.bulkInput.clear | erpTranslate }}
              </button>
            }
          </div>
        </div>
      </tui-textfield>

      @if (errorText) {
        <tui-error [error]="errorText" [class.erp-shake]="shake()" (animationend)="onShakeEnd($event)" />
      }

      @if (hintText) {
        <div class="erp-bulk-input-hint">{{ hintText }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    /* Taiga UI wymusza przezroczyste tło dla data-mode="readonly" (!important),
       a input wewnątrz tui-textfield jest readOnly, bo edycja odbywa się w panelu textarea.
       Przywracamy tu dokładnie te same tokeny, których Taiga używa domyślnie dla
       edytowalnego tui-textfield w każdym z motywów (theme/appearance/textfield.less). */
    :host tui-textfield[tuiappearance][data-appearance='textfield'][data-mode~='readonly'] {
      background: var(--tui-background-base) !important;
    }

    :host-context([tuiTheme='dark']) tui-textfield[tuiappearance][data-appearance='textfield'][data-mode~='readonly'] {
      background: var(--tui-background-neutral-1) !important;
    }

    /* Taiga chowa natywny cleaner ([tuiButtonX]) w trybie readonly — tutaj używamy go świadomie
       jako przycisku czyszczącego wszystkie wartości bez otwierania panelu textarea. */
    :host tui-textfield[data-mode~='readonly'] [tuiButtonX] {
      display: inline-flex !important;
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

    .erp-bulk-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    /* Panel dropdownu: nigdy węższy niż input (wymusza to \`erpDropdownMinWidth\` na
       tui-textfield), a \`min-width\` niżej to wygodny domyślny rozmiar dla wąskich inputów
       (np. w panelu filtrów) — bez tego textarea potrafiła być nieporęcznie wąska. Górny
       limit pilnuje sama Taiga (\`maxWidth\` liczone z viewportu przy \`limitWidth: 'min'\`). */
    .erp-bulk-input-panel {
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      width: 100%;
      min-width: 32rem;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    .erp-bulk-input-panel textarea {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 7.5rem;
      max-height: 16rem;
    }

    /* margin zamiast gap na .erp-bulk-input-panel: tuiTextarea wstrzykuje wewnętrzny
       <tui-textarea-content display:contents> — jego dzieci (scroll-controls, ghost sizer)
       stają się dodatkowymi (niewidocznymi) elementami flex, więc "gap" liczyłby się podwójnie. */
    .erp-bulk-input-panel__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-shrink: 0;
      margin-top: 0.5rem;
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
    }

    .erp-bulk-input-hint {
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpBulkInputComponent implements ControlValueAccessor {
  protected readonly SHARED_KEYS = SHARED_KEYS;
  protected readonly SUMMARY_INLINE_LIMIT = SUMMARY_INLINE_LIMIT;

  readonly config = input.required<ErpBulkInputConfig>();
  readonly control = input<FormControl<string[] | null> | null>(null);

  readonly internalControl = new FormControl<string[] | null>([]);
  readonly activeControl = computed(() => this.control() || this.internalControl);

  /** Surowy, edytowalny tekst wewnątrz rozwijanego panelu. */
  protected readonly rawTextControl = new FormControl<string>('', { nonNullable: true });
  private readonly rawText = signal('');

  /** Stan rozwinięcia panelu — sterowany jawnie (otwarcie: focus/klik pola, zamknięcie: utrata focusu z textarea). */
  protected readonly isOpen = signal(false);
  private readonly rawTextareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('rawTextarea');
  private readonly hostInputRef = viewChild<ElementRef<HTMLInputElement>>('hostInput');

  protected readonly shake = signal<boolean>(false);
  private readonly stateTrigger = signal(0);
  private lastShakeTime = 0;

  private _onChange: (value: string[] | null) => void = noop;
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
        } else {
          this.activeControl().enable({ emitEvent: false });
        }
        this.stateTrigger.update(v => v + 1);
      });
    });

    effect((onCleanup) => {
      const ctrl = this.activeControl();
      const sub = ctrl.valueChanges.subscribe(() => {
        this.stateTrigger.update(v => v + 1);
      });
      onCleanup(() => sub.unsubscribe());
    });

    this.internalControl.valueChanges.subscribe((val) => {
      this._onChange(val);
    });

    this.rawTextControl.valueChanges.subscribe(val => this.rawText.set(val));
  }

  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _disabled = computed(() => !!unwrapSignal(this.config().disabled));

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

  protected readonly currentValues = computed(() => {
    this.stateTrigger();
    return this.activeControl().value ?? [];
  });

  protected readonly rawValuesCount = computed(() => this.parse(this.rawText()).length);

  protected onDropdownOpenChange(open: boolean): void {
    this.isOpen.set(open);
    if (open) {
      this.rawTextControl.setValue(this.currentValues().join('\n'), { emitEvent: false });
      this.rawText.set(this.rawTextControl.value);
      queueMicrotask(() => this.rawTextareaRef()?.nativeElement.focus());
    } else {
      this.commitRawText();
      this.onTouched();
      this.activeControl().markAsTouched();
      this.stateTrigger.update(v => v + 1);
    }
  }

  /** Utrata focusu z textarea = "zatwierdzenie" wpisanych wartości (zastępuje przycisk Zastosuj). */
  protected onTextareaBlur(): void {
    this.commitRawText();
    this.isOpen.set(false);
    this.onTouched();
    this.activeControl().markAsTouched();
    this.stateTrigger.update(v => v + 1);
  }

  /** Escape z klawiatury zamyka panel tak samo jak utrata focusu — zwraca fokus na pole, żeby dało się kontynuować Tabem. */
  protected onTextareaEscape(): void {
    this.hostInputRef()?.nativeElement.focus();
  }

  protected clearRawText(): void {
    this.rawTextControl.setValue('', { emitEvent: false });
    this.rawText.set('');
    this.rawTextareaRef()?.nativeElement.focus();
  }

  /** Czyści wszystkie wartości z poziomu zwiniętego pola, bez otwierania panelu textarea. */
  protected clearAllValues(): void {
    this.rawTextControl.setValue('', { emitEvent: false });
    this.rawText.set('');
    this.updateActiveValue([]);
    this.onTouched();
    this.activeControl().markAsTouched();
  }

  private commitRawText(): void {
    const parsed = this.parse(this.rawTextControl.value);
    const current = this.currentValues();
    const changed = parsed.length !== current.length || parsed.some((v, i) => v !== current[i]);
    if (changed) {
      this.updateActiveValue(parsed);
    }
  }

  private parse(rawText: string): string[] {
    const values = rawText
      .split(SPLIT_PATTERN)
      .map(v => v.trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }

  private updateActiveValue(val: string[]): void {
    const ctrl = this.activeControl();
    ctrl.markAsDirty();
    ctrl.setValue(val);
    this.stateTrigger.update(v => v + 1);
    if (this._error()) {
      this.triggerShakeIfInvalid();
    }
  }

  protected triggerShakeIfInvalid(): void {
    if (!this._error()) return;
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

  public writeValue(val: string[] | null): void {
    this.internalControl.setValue(val ?? [], { emitEvent: false });
  }

  public registerOnChange(fn: (value: string[] | null) => void): void {
    this._onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.internalControl.disable({ emitEvent: false }) : this.internalControl.enable({ emitEvent: false });
  }
}
