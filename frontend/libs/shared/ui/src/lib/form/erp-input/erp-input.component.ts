import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  untracked,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';
import { TuiTextfieldComponent, TuiTextfieldOptionsDirective } from '@taiga-ui/core/components/textfield';
import { TuiInputDirective } from '@taiga-ui/core/components/input';
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

    <div class="erp-input-wrapper">
      <tui-textfield
        [tuiTextfieldSize]="_size()"
        [tuiTextfieldCleaner]="_clearable() && !!value()"
      >
        <input
          tuiInput
          [type]="_type()"
          [placeholder]="placeholderText"
          [disabled]="_disabled()"
          [(ngModel)]="value"
          [invalid]="!!errorText || invalid()"
          (blur)="touched.set(true)"
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
  
  // FormValueControl contract properties
  readonly value = model<string>('');
  readonly disabled = input<boolean>(false);
  readonly touched = model<boolean>(false);
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);

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

  protected readonly _disabled = computed(() => unwrapSignal(this.config().disabled) || this.disabled());
  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected readonly _iconEnd = computed(() => unwrapSignal(this.config().iconEnd));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _error = computed(() => {
    const configErr = unwrapSignal(this.config().error);
    if (configErr) return configErr;
    if (this.touched() && this.errors().length > 0) {
      return this.errors()[0].message || this.errors()[0].kind;
    }
    return undefined;
  });
  protected readonly _clearable = computed(() => unwrapSignal(this.config().clearable) ?? false);
  protected readonly _type = computed(() => unwrapSignal(this.config().type) ?? 'text');
}
