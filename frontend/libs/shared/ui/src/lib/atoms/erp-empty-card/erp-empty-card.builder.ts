import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpEmptyCardConfig } from './erp-empty-card.component';

export class ErpEmptyCardBuilder extends ErpBaseBuilder<ErpEmptyCardConfig> {
  /** Ikona PrimeNG wyświetlana w centralnej części pustej karty. */
  public setIcon(icon: string): this {
    this._data.icon = icon;
    return this;
  }

  /** Tytuł pustej karty. */
  public setTitle(title: string): this {
    this._data.title = title;
    return this;
  }

  /** Podtytuł pustej karty. */
  public setSubtitle(subtitle: string): this {
    this._data.subtitle = subtitle;
    return this;
  }

  /** Opis (dłuższy tekst) wyświetlany pod tytułem. */
  public setDescription(description: string): this {
    this._data.description = description;
    return this;
  }

  /** Włącza animację pulsowania ikony. */
  public withPulse(showPulse = true): this {
    this._data.showPulse = showPulse;
    return this;
  }
}
