import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { ErpTextConfig } from './erp-text.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-text',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    @let _value = value();
    @let _params = params();
    @let _tag = tag() ?? 'span';
    @let _class = classProp();

    @if (isArray(_value)) {
      @switch (_tag) {
        @case ('span') {
          <span [class]="_class">
            @for (val of _value; track $index) {
              {{ val | transloco:_params }}
              @if (!$last) { > }
            }
          </span>
        }
        @case ('p') {
          <p [class]="_class">
            @for (val of _value; track $index) {
              {{ val | transloco:_params }}
              @if (!$last) { > }
            }
          </p>
        }
        @case ('div') {
          <div [class]="_class">
            @for (val of _value; track $index) {
              {{ val | transloco:_params }}
              @if (!$last) { > }
            }
          </div>
        }
      }
    } @else if (_value) {
      @switch (_tag) {
        @case ('span') {
          <span [class]="_class">{{ _value | transloco:_params }}</span>
        }
        @case ('p') {
          <p [class]="_class">{{ _value | transloco:_params }}</p>
        }
        @case ('div') {
          <div [class]="_class">{{ _value | transloco:_params }}</div>
        }
        @case ('h1') {
          <h1 [class]="_class">{{ _value | transloco:_params }}</h1>
        }
        @case ('h2') {
          <h2 [class]="_class">{{ _value | transloco:_params }}</h2>
        }
        @case ('h3') {
          <h3 [class]="_class">{{ _value | transloco:_params }}</h3>
        }
        @case ('h4') {
          <h4 [class]="_class">{{ _value | transloco:_params }}</h4>
        }
        @case ('h5') {
          <h5 [class]="_class">{{ _value | transloco:_params }}</h5>
        }
        @case ('h6') {
          <h6 [class]="_class">{{ _value | transloco:_params }}</h6>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTextComponent {
  public config = input.required<ErpTextConfig>();

  protected readonly value = computed(() => unwrapSignal(this.config().value));
  protected readonly params = computed(() => unwrapSignal(this.config().params));
  protected readonly tag = computed(() => unwrapSignal(this.config().tag));
  protected readonly classProp = computed(() => unwrapSignal(this.config().class));

  protected isArray(val: unknown): val is string[] {
    return Array.isArray(val);
  }
}
