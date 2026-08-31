import { ErpBaseBuilder, MaybeSignal } from '@erp/shared/ui';

import { ErpIssueCardConfig } from './erp-issue-card.types';

export class ErpIssueCardBuilder extends ErpBaseBuilder<ErpIssueCardConfig> {
  public setIssueKey(value: MaybeSignal<string>): this {
    this._data.issueKey = value;
    return this;
  }

  public setTitle(value: MaybeSignal<string>): this {
    this._data.title = value;
    return this;
  }

  public setPriority(value: MaybeSignal<number>): this {
    this._data.priority = value;
    return this;
  }

  public setPriorityLabelKey(value: MaybeSignal<string>): this {
    this._data.priorityLabelKey = value;
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

  public setAssigneeUuid(value: MaybeSignal<string | undefined>): this {
    this._data.assigneeUuid = value;
    return this;
  }

  public setAssigneeEmptyLabel(value: MaybeSignal<string | undefined>): this {
    this._data.assigneeEmptyLabel = value;
    return this;
  }

  public setLink(value: MaybeSignal<readonly unknown[]>): this {
    this._data.link = value;
    return this;
  }
}
