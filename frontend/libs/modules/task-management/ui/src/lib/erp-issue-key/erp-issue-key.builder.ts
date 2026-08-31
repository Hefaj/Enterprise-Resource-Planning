import { ErpBaseBuilder, MaybeSignal } from '@erp/shared/ui';

import { ErpIssueKeyConfig } from './erp-issue-key.types';

export class ErpIssueKeyBuilder extends ErpBaseBuilder<ErpIssueKeyConfig> {
  public setIssueKey(value: MaybeSignal<string>): this {
    this._data.issueKey = value;
    return this;
  }

  public setTypeIcon(value: MaybeSignal<string | undefined>): this {
    this._data.typeIcon = value;
    return this;
  }

  public setTypeName(value: MaybeSignal<string | undefined>): this {
    this._data.typeName = value;
    return this;
  }

  public setLink(value: MaybeSignal<readonly unknown[] | undefined>): this {
    this._data.link = value;
    return this;
  }
}
