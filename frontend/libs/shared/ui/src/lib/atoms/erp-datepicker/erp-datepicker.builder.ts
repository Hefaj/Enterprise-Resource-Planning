import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpDatePickerConfig } from './erp-datepicker.types';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { TuiDay } from '@taiga-ui/cdk/date-time';

export class ErpDatePickerBuilder extends ErpInputBaseBuilder<ErpDatePickerConfig> {
  public setMin(min: MaybeSignal<TuiDay | null | undefined>): this {
    this._data.min = min;
    return this;
  }

  public setMax(max: MaybeSignal<TuiDay | null | undefined>): this {
    this._data.max = max;
    return this;
  }

  public setIcon(icon: MaybeSignal<string | undefined>): this {
    this._data.icon = icon;
    return this;
  }

  public setFluid(fluid: MaybeSignal<boolean | undefined> = true): this {
    this._data.fluid = fluid;
    return this;
  }

  public setSize(size: MaybeSignal<'small' | 'large' | undefined>): this {
    this._data.size = size;
    return this;
  }
}
