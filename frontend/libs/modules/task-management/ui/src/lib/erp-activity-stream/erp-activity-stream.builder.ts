import { TemplateRef } from '@angular/core';

import { ErpBaseBuilder, MaybeSignal } from '@erp/shared/ui';

import { ErpActivityStreamConfig, ErpActivityStreamEntry } from './erp-activity-stream.types';

export class ErpActivityStreamBuilder extends ErpBaseBuilder<ErpActivityStreamConfig> {
  public setEntries(value: MaybeSignal<readonly ErpActivityStreamEntry[]>): this {
    this._data.entries = value;
    return this;
  }

  public setExpandedUuid(value: MaybeSignal<string | undefined>): this {
    this._data.expandedUuid = value;
    return this;
  }

  public setCanWrite(value: MaybeSignal<boolean>): this {
    this._data.canWrite = value;
    return this;
  }

  public setComposerTemplate(value: TemplateRef<void>): this {
    this._data.composerTemplate = value;
    return this;
  }

  public setEntryExtraTemplate(value: TemplateRef<{ $implicit: ErpActivityStreamEntry }>): this {
    this._data.entryExtraTemplate = value;
    return this;
  }
}
