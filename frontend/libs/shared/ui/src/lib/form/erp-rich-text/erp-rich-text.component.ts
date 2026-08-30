import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TUI_EDITOR_PROVIDERS, TUI_IMAGE_LOADER, TuiEditor, TuiEditorSocket, provideTuiEditor } from '@taiga-ui/editor';
import { noop } from 'rxjs';

import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { erpClipboardImageUrls } from './erp-rich-text-clipboard.utils';
import { ErpRichTextConfig } from './erp-rich-text.types';
import { erpRichTextToolset } from './erp-rich-text.builder';

/**
 * Pole tekstu formatowanego — opakowanie `tui-editor` (TaigaUI, tiptap pod spodem) w konwencję
 * Single Config Builder (`docs/frontend/atoms.md`).
 *
 * <p><b>Wartość to HTML.</b> Edytor jest `ControlValueAccessor` nad `string`, więc wpina się
 * w formularz jak `erp-input`. Treść pochodzi od użytkownika, więc <b>backend musi ją oczyścić
 * przy zapisie</b> — renderowanie tutaj jest bezpieczne (Angular sanityzuje `[innerHTML]`,
 * a `tui-editor-socket` idzie przez `DomSanitizer`), ale zapisany HTML czytają też inni
 * konsumenci: eksporty, powiadomienia, integracje.</p>
 *
 * <p><b>Podgląd nie ładuje edytora.</b> Przy `readOnly` renderuje się `tui-editor-socket` —
 * ta sama typografia, zero tiptap w bundlu ścieżki krytycznej. Karta zgłoszenia stoi w tym
 * trybie, dopóki użytkownik nie kliknie „edytuj”.</p>
 */
@Component({
  selector: 'erp-rich-text',
  standalone: true,
  imports: [ReactiveFormsModule, TuiEditor, TuiEditorSocket, TuiLabel, TuiErrorComponent, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpRichTextComponent),
      multi: true,
    },
    TUI_EDITOR_PROVIDERS,
    // Rozszerzenia tiptap ładowane leniwie przez `provideTuiEditor` — bez tego edytor wstaje
    // bez żadnego formatowania, a pasek narzędzi klika w pustkę.
    provideTuiEditor(),
  ],
  template: `
    @let labelText = (_label() | erpTranslate) || '';
    @let placeholderText = (_placeholder() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';

    <div class="erp-rich-text-wrapper">
      @if (labelText) {
        <label tuiLabel>{{ labelText }}</label>
      }

      @if (_readOnly()) {
        <tui-editor-socket [content]="activeControl().value ?? ''" />
      } @else {
        <tui-editor
          [formControl]="activeControl()"
          [placeholder]="placeholderText"
          [tools]="_tools()"
          [style.min-height.px]="_minHeight()"
        />
      }

      @if (errorText) {
        <tui-error [error]="errorText" />
      }

      @if (hintText) {
        <div class="erp-rich-text-hint">{{ hintText }}</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .erp-rich-text-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .erp-rich-text-hint {
        font: var(--tui-typography-body-xs);
        color: var(--tui-text-secondary);
      }

      tui-error {
        font: var(--tui-typography-body-xs);
      }
    `,
  ],
})
export class ErpRichTextComponent implements ControlValueAccessor {
  public readonly config = input.required<ErpRichTextConfig>();

  /** Kontrolka z zewnątrz; bez niej komponent pracuje na własnej (tryb `ngModel`/samodzielny). */
  public readonly control = input<FormControl | null>(null);

  public readonly internalControl = new FormControl<string>('');

  public readonly activeControl = computed(() => this.control() ?? this.internalControl);

  /**
   * Taiga obsługuje obraz z `DataTransfer.files`. Ten fallback dotyczy wyłącznie przeglądarek,
   * które wystawiają screenshot z systemowego schowka tylko przez
   * `DataTransferItem.getAsFile()`. Dla zwykłego pliku nie robi nic, aby nie zdublować
   * uploadu wykonywanego już przez Taiga.
   */
  private readonly _editor = viewChild(TuiEditor);
  private readonly _imageLoader = inject(TUI_IMAGE_LOADER, { optional: true });
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _readOnly = computed(() => unwrapSignal(this.config().readOnly) ?? false);
  protected readonly _minHeight = computed(() => unwrapSignal(this.config().minHeight) ?? 160);

  /** Jawna lista narzędzi wygrywa z zestawem nazwanym; brak obu daje `standard`. */
  protected readonly _tools = computed(() => {
    const explicit = unwrapSignal(this.config().tools);
    return explicit ? [...explicit] : [...erpRichTextToolset(unwrapSignal(this.config().toolset) ?? 'standard')];
  });

  protected readonly _error = computed(() => {
    const control = this.activeControl();
    if (!control.touched || !control.errors) {
      return undefined;
    }

    const messages = unwrapSignal(this.config().errorMessages);
    const firstError = Object.keys(control.errors)[0];
    return messages?.[firstError];
  });

  private _onChange: (value: string | null) => void = noop;
  protected onTouched: () => void = noop;

  public constructor() {
    afterNextRender(() => this._registerClipboardImageHandler());

    effect(() => {
      const value = unwrapSignal(this.config().value);
      if (value !== undefined) {
        untracked(() => this.activeControl().setValue(value ?? '', { emitEvent: false }));
      }
    });

    effect(() => {
      const isDisabled = unwrapSignal(this.config().disabled) ?? false;
      untracked(() => {
        if (isDisabled) {
          this.activeControl().disable({ emitEvent: false });
        } else {
          this.activeControl().enable({ emitEvent: false });
        }
      });
    });

    this.internalControl.valueChanges.subscribe((value) => this._onChange(value ?? null));
  }

  /** @inheritdoc */
  public writeValue(value: string | null): void {
    this.internalControl.setValue(value ?? '', { emitEvent: false });
  }

  /** @inheritdoc */
  public registerOnChange(fn: (value: string | null) => void): void {
    this._onChange = fn;
  }

  /** @inheritdoc */
  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** @inheritdoc */
  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.internalControl.disable({ emitEvent: false });
    } else {
      this.internalControl.enable({ emitEvent: false });
    }
  }

  private _registerClipboardImageHandler(): void {
    const editor = this._editor();
    const host = editor?.rootEl;
    const imageLoader = this._imageLoader;

    if (!editor || !host || !imageLoader) {
      return;
    }

    const onPaste = (event: ClipboardEvent): void => {
      const imageUrls = erpClipboardImageUrls(event, imageLoader);

      if (!imageUrls) {
        return;
      }

      imageUrls.pipe(takeUntilDestroyed(this._destroyRef)).subscribe({
        next: (url) => editor.editor?.setImage(url),
        // Loader modułu raportuje błąd własnym komunikatem. Nie pozwalamy, aby błąd
        // asynchronicznego uploadu wyszedł z subskrypcji jako nieobsłużony wyjątek.
        error: () => undefined,
      });
    };

    host.addEventListener('paste', onPaste, { capture: true });
    this._destroyRef.onDestroy(() => host.removeEventListener('paste', onPaste, { capture: true }));
  }

}
