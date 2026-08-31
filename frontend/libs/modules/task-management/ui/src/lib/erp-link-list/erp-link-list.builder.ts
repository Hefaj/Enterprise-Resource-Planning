import { ErpBaseBuilder, MaybeSignal } from '@erp/shared/ui';

import { ErpLinkListConfig, ErpLinkListRow, ErpLinkListTypeOption } from './erp-link-list.types';

export class ErpLinkListBuilder extends ErpBaseBuilder<ErpLinkListConfig> {
  public setParent(value: MaybeSignal<ErpLinkListRow | undefined>): this {
    this._data.parent = value;
    return this;
  }

  public setChildren(value: MaybeSignal<readonly ErpLinkListRow[]>): this {
    this._data.children = value;
    return this;
  }

  public setLinks(value: MaybeSignal<readonly ErpLinkListRow[]>): this {
    this._data.links = value;
    return this;
  }

  public setLinkTypeOptions(value: MaybeSignal<readonly ErpLinkListTypeOption[]>): this {
    this._data.linkTypeOptions = value;
    return this;
  }

  public setSaving(value: MaybeSignal<boolean>): this {
    this._data.saving = value;
    return this;
  }

  public setError(value: MaybeSignal<string | undefined>): this {
    this._data.error = value;
    return this;
  }
}
