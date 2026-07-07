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
import { MaskitoDirective } from '@maskito/angular';
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
    MaskitoDirective,
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
          [maskito]="_mask() ?? null"
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
  }

  protected onBlur(): void {
    this.formField?.state().markAsTouched();
  }

  protected readonly _disabled = computed(() => 
    unwrapSignal(this.config().disabled) || (this.formField?.state().disabled() ?? false)
  );

  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected readonly _iconEnd = computed(() => unwrapSignal(this.config().iconEnd));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _mask = computed(() => unwrapSignal(this.config().mask));

  protected readonly _error = computed(() => {
    const isTouched = this.formField?.state().touched() ?? false;
    const fieldErrors = this.formField?.errors() ?? [];
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
    !!this._error() || (this.formField?.state().invalid() ?? false)
  );
}
