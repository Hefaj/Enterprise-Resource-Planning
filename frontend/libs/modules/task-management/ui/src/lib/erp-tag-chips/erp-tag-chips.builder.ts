import { ErpBaseBuilder, MaybeSignal } from '@erp/shared/ui';

import { ErpTagChipItem, ErpTagChipsConfig } from './erp-tag-chips.types';

export class ErpTagChipsBuilder extends ErpBaseBuilder<ErpTagChipsConfig> {
  public setItems(value: MaybeSignal<readonly ErpTagChipItem[]>): this {
    this._data.items = value;
    return this;
  }

  public setSize(value: MaybeSignal<'xs' | 's' | 'm'>): this {
    this._data.size = value;
    return this;
  }

  public setRemovable(value: MaybeSignal<boolean>): this {
    this._data.removable = value;
    return this;
  }
}
