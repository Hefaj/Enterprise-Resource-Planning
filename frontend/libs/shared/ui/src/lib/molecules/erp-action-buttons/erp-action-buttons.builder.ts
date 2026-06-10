import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpActionButtonsConfig, ErpActionItem } from './erp-action-buttons.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpActionButtonsBuilder extends ErpBaseBuilder<ErpActionButtonsConfig> {
  constructor() {
    super();
    this._data.buttons = [];
  }

  public setButtons(buttons: MaybeSignal<ErpActionItem[]>): this {
    this._data.buttons = buttons;
    return this;
  }

  public addButton(item: ErpActionItem): this {
    if (Array.isArray(this._data.buttons)) {
      this._data.buttons.push(item);
    }
    return this;
  }

  public setAlignment(alignment: MaybeSignal<'start' | 'end' | 'center' | 'between' | undefined>): this {
    this._data.alignment = alignment;
    return this;
  }

  public setGap(gap: MaybeSignal<number | undefined>): this {
    this._data.gap = gap;
    return this;
  }
}
