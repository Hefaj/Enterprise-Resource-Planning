import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTextConfig, ErpTextTag } from './erp-text.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpTextBuilder extends ErpBaseBuilder<ErpTextConfig> {
  public setValue(value: MaybeSignal<string | string[] | undefined>): this {
    this._data.value = value;
    return this;
  }

  public setParams(params: MaybeSignal<Record<string, unknown> | undefined>): this {
    this._data.params = params;
    return this;
  }

  public setTag(tag: MaybeSignal<ErpTextTag | undefined>): this {
    this._data.tag = tag;
    return this;
  }

  public setClass(className: MaybeSignal<string | undefined>): this {
    this._data.class = className;
    return this;
  }
}
