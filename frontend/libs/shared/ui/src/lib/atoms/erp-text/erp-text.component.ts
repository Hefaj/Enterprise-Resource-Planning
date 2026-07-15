import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpTextConfig } from './erp-text.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-text',
  standalone: true,
  imports: [CommonModule, ErpTranslatePipe],
  template: `
    @let _value = resolvedValue();
    @let _tag = tag() ?? 'span';
    @let _class = classProp();

    @if (isArray(_value)) {
      @switch (_tag) {
        @case ('span') {
          <span [class]="_class">
            @for (val of _value; track $index) {
              {{ val | erpTranslate }}
              @if (!$last) { > }
            }
          </span>
        }
        @case ('p') {
          <p [class]="_class">
            @for (val of _value; track $index) {
              {{ val | erpTranslate }}
              @if (!$last) { > }
            }
          </p>
        }
        @case ('div') {
          <div [class]="_class">
            @for (val of _value; track $index) {
              {{ val | erpTranslate }}
              @if (!$last) { > }
            }
          </div>
        }
      }
    } @else if (_value) {
      @switch (_tag) {
        @case ('span') {
          <span [class]="_class">{{ _value | erpTranslate }}</span>
        }
        @case ('p') {
          <p [class]="_class">{{ _value | erpTranslate }}</p>
        }
        @case ('div') {
          <div [class]="_class">{{ _value | erpTranslate }}</div>
        }
        @case ('h1') {
          <h1 [class]="_class">{{ _value | erpTranslate }}</h1>
        }
        @case ('h2') {
          <h2 [class]="_class">{{ _value | erpTranslate }}</h2>
        }
        @case ('h3') {
          <h3 [class]="_class">{{ _value | erpTranslate }}</h3>
        }
        @case ('h4') {
          <h4 [class]="_class">{{ _value | erpTranslate }}</h4>
        }
        @case ('h5') {
          <h5 [class]="_class">{{ _value | erpTranslate }}</h5>
        }
        @case ('h6') {
          <h6 [class]="_class">{{ _value | erpTranslate }}</h6>
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

  protected readonly resolvedValue = computed(() => {
    const val = this.value();
    const defaultParams = this.params();
    if (!val) return undefined;
    if (Array.isArray(val)) {
      return val.map(v => this.getTranslatable(v, defaultParams));
    }
    return this.getTranslatable(val, defaultParams);
  });

  private getTranslatable(val: Translatable, defaultParams?: any): Translatable {
    if (typeof val === 'string') {
      return defaultParams ? { key: val, params: defaultParams } : val;
    }
    return {
      key: val.key,
      params: { ...defaultParams, ...val.params }
    };
  }

  protected isArray(val: unknown): val is Translatable[] {
    return Array.isArray(val);
  }
}
