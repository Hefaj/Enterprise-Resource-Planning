import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpEmptyStateConfig } from './erp-empty-state.types';

export class ErpEmptyStateBuilder extends ErpBaseBuilder<ErpEmptyStateConfig> {
  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  public setMessage(message: MaybeSignal<Translatable>): this {
    this._data.message = message;
    return this;
  }
}
