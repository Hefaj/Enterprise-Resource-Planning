import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpEmptyCardConfig } from './erp-empty-card.types';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpEmptyCardBuilder extends ErpBaseBuilder<ErpEmptyCardConfig> {


  public setIcon(icon: MaybeSignal<string | undefined>): this {
    this._data.icon = icon;
    return this;
  }

  public setTitle(title: MaybeSignal<string | undefined>): this {
    this._data.title = title;
    return this;
  }

  public setSubtitle(subtitle: MaybeSignal<string | undefined>): this {
    this._data.subtitle = subtitle;
    return this;
  }

  public setDescription(description: MaybeSignal<string | undefined>): this {
    this._data.description = description;
    return this;
  }

  public setShowPulse(showPulse: MaybeSignal<boolean | undefined> = true): this {
    this._data.showPulse = showPulse;
    return this;
  }
}
