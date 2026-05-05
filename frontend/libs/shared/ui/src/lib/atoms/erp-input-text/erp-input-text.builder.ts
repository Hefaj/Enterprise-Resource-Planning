import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpInputText } from './erp-input-text.component';

export class ErpInputTextBuilder extends ErpInputBaseBuilder<ErpInputText> {
  public setFluid(fluid = true): this {
    this._data.fluid = fluid;
    return this;
  }

  public setSize(size: 'small' | 'large'): this {
    this._data.size = size;
    return this;
  }

  public setVariant(variant: 'filled' | 'outlined'): this {
    this._data.variant = variant;
    return this;
  }

  public setIcon(icon: string): this {
    this._data.icon = icon;
    return this;
  }
}
