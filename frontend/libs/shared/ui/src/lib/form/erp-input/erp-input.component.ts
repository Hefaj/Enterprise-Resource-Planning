import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormValueControl, ValidationError, FORM_FIELD } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';
import { TuiTextfieldComponent, TuiTextfieldOptionsDirective } from '@taiga-ui/core/components/textfield';
import { TuiInputDirective } from '@taiga-ui/core/components/input';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiIcon } from '@taiga-ui/core/components/icon';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpInputConfig } from './erp-input.types';

@Component({
  selector: 'erp-input',
  standalone: true,
  imports: [
    FormsModule,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiInputDirective,
    TuiLabel,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || '';
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';

    <div class="erp-input-wrapper">
      <tui-textfield
        [tuiTextfieldSize]="_size()"
        [tuiTextfieldCleaner]="!!value()"
      >
        @if (labelText) {
          <label tuiLabel>{{ labelText }}</label>
        }
        <input
          tuiInput
          [type]="_inputType()"
          [placeholder]="placeholderText"
          [disabled]="_disabled()"
          [(ngModel)]="value"
          [invalid]="_invalid()"
          (blur)="onBlur()"
        />

        @if (_iconStart()) {
          <tui-icon [icon]="_iconStart()!" />
        }

        @if (_tooltip() && tooltipText) {
          <tui-icon
            icon="@tui.circle-help"
            [tuiHint]="tooltipText"
          />
        }

        @if (_type() === 'password') {
          <tui-icon
            [icon]="showPassword() ? '@tui.eye-off' : '@tui.eye'"
            (click)="showPassword.set(!showPassword())"
            style="cursor: pointer"
          />
        }
      </tui-textfield>

      @if (errorText) {
        <tui-error [error]="errorText" />
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpInputComponent implements FormValueControl<string> {
  readonly config = input.required<ErpInputConfig>();
  
  // Required by FormValueControl contract
  readonly value = model<string>('');

  private readonly formField = inject(FORM_FIELD, { optional: true });
  protected readonly showPassword = signal<boolean>(false);

  constructor() {
    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.value.set(configVal);
        });
      }
    });

    // Reaktywna synchronizacja wartości z config.formField do value
    effect(() => {
      const configFieldTree = unwrapSignal(this.config().formField);
      if (configFieldTree) {
        const val = configFieldTree().value();
        untracked(() => {
          if (this.value() !== val) {
            this.value.set(val as string);
          }
        });
      }
    });

    // Reaktywna synchronizacja wartości z value z powrotem do config.formField
    effect(() => {
      const configFieldTree = unwrapSignal(this.config().formField);
      if (configFieldTree) {
        const val = this.value();
        untracked(() => {
          const fieldState = configFieldTree();
          if (fieldState.value() !== val) {
            fieldState.value.set(val);
          }
        });
      }
    });
  }

  private getFieldState() {
    if (this.formField) {
      return this.formField.state();
    }
    const configFieldTree = unwrapSignal(this.config().formField);
    if (configFieldTree) {
      return configFieldTree();
    }
    return null;
  }

  private getFieldErrors() {
    if (this.formField) {
      return this.formField.errors();
    }
    const configFieldTree = unwrapSignal(this.config().formField);
    if (configFieldTree) {
      return configFieldTree().errors();
    }
    return [];
  }

  protected onBlur(): void {
    this.formField?.state().markAsTouched();
    const configFieldTree = unwrapSignal(this.config().formField);
    if (configFieldTree) {
      configFieldTree().markAsTouched();
    }
  }

  protected readonly _disabled = computed(() => {
    const configDisabled = unwrapSignal(this.config().disabled);
    if (configDisabled !== undefined) return configDisabled;
    
    const state = this.getFieldState();
    return state ? state.disabled() : false;
  });

  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected readonly _iconEnd = computed(() => unwrapSignal(this.config().iconEnd));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');

  protected readonly _error = computed(() => {
    const isTouched = this.getFieldState()?.touched() ?? false;
    const fieldErrors = this.getFieldErrors() ?? [];
    if (isTouched && fieldErrors.length > 0) {
      const firstError = fieldErrors[0];
      const errorMessages = unwrapSignal(this.config().errorMessages);
      if (errorMessages && errorMessages[firstError.kind]) {
        return errorMessages[firstError.kind];
      }
      return firstError.message || firstError.kind;
    }
    return undefined;
  });

  protected readonly _type = computed(() => unwrapSignal(this.config().type) ?? 'text');
  protected readonly _inputType = computed(() => {
    const originalType = this._type();
    if (originalType === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return originalType;
  });

  protected readonly _invalid = computed(() => 
    !!this._error() || (this.getFieldState()?.invalid() ?? false)
  );
}
