import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  untracked,
} from '@angular/core';
import { FormValueControl, FORM_FIELD } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';
import { TuiTextfieldComponent } from '@taiga-ui/core/components/textfield';
import { TuiInputColor } from '@taiga-ui/kit';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiIcon } from '@taiga-ui/core/components/icon';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpInputColorConfig } from './erp-input-color.types';

@Component({
  selector: 'erp-input-color',
  standalone: true,
  imports: [
    FormsModule,
    TuiTextfieldComponent,
    TuiInputColor,
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

    <div class="erp-input-color-wrapper">
      <tui-textfield
        [tuiTextfieldSize]="_size()"
        [tuiTextfieldCleaner]="true"
      >
        @if (labelText) {
          <label tuiLabel>{{ labelText }}</label>
        }
        <input
          tuiInputColor
          [placeholder]="placeholderText"
          [disabled]="_disabled()"
          [(ngModel)]="value"
          [invalid]="_invalid()"
          (blur)="onBlur()"
        />

        @if (_tooltip() && tooltipText) {
          <tui-icon
            icon="@tui.circle-help"
            [tuiHint]="tooltipText"
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

    .erp-input-color-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpInputColorComponent implements FormValueControl<string> {
  readonly config = input.required<ErpInputColorConfig>();

  readonly value = model<string>('');

  private readonly formField = inject(FORM_FIELD, { optional: true });

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
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');

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

  protected readonly _invalid = computed(() =>
    !!this._error() || (this.formField?.state().invalid() ?? false)
  );
}
