import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpEmptyCardConfig } from './erp-empty-card.component';

export class ErpEmptyCardBuilder extends ErpBaseBuilder<ErpEmptyCardConfig> {
  public setIcon(icon: string): this {
    this._data.icon = icon;
    return this;
  }

  public setTitle(title: string): this {
    this._data.title = title;
    return this;
  }

  public setDescription(description: string): this {
    this._data.description = description;
    return this;
  }

  public withPulse(showPulse = true): this {
    this._data.showPulse = showPulse;
    return this;
  }
}
