import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpGroupCardAction, ErpGroupCardConfig } from './erp-group-card.types';

/**
 * Klasa Builder dla komponentu ErpGroupCard, dostarczająca interfejs fluent API
 * do konfiguracji kart grupujących z nagłówkiem, akcjami i slotowaną treścią.
 *
 * @example
 * ```ts
 * protected readonly cardConfig = ErpGroupCardBuilder.create((b) =>
 *   b
 *     .setTitle('Laptop X1 Carbon (SKU-001)')
 *     .setIcon('@tui.package')
 *     .setLoading(this.isLoading)
 *     .setPlaceholderHeight(200)
 *     .addAction({ label: 'Dodaj', icon: '@tui.plus', onClick: () => this.add() })
 * );
 * ```
 */
export class ErpGroupCardBuilder extends ErpBaseBuilder<ErpGroupCardConfig> {
  constructor() {
    super();
    this._data.actions = [];
  }

  /**
   * Ustawia tytuł grupy.
   */
  public setTitle(title: MaybeSignal<Translatable>): this {
    this._data.title = title;
    return this;
  }

  /**
   * Ustawia podtytuł grupy.
   */
  public setSubtitle(subtitle: MaybeSignal<Translatable>): this {
    this._data.subtitle = subtitle;
    return this;
  }

  /**
   * Ustawia ikonę w nagłówku.
   */
  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  /**
   * Ustawia stan rozwinięcia (true = expanded, false = collapsed).
   */
  public setExpanded(expanded: MaybeSignal<boolean>): this {
    this._data.expanded = expanded;
    return this;
  }

  /**
   * Ustawia stan zaznaczenia (highlight border).
   */
  public setSelected(selected: MaybeSignal<boolean>): this {
    this._data.selected = selected;
    return this;
  }

  /**
   * Ustawia callback wywoływany przy toggle rozwinięcia.
   */
  public setOnToggle(fn: (expanded: boolean) => void): this {
    this._data.onToggle = fn;
    return this;
  }

  /**
   * Dodaje akcję do nagłówka grupy.
   */
  public addAction(action: ErpGroupCardAction): this {
    this._data.actions!.push(action);
    return this;
  }

  /**
   * Ustawia stan ładowania (skeleton loader).
   */
  public setLoading(loading: MaybeSignal<boolean>): this {
    this._data.loading = loading;
    return this;
  }

  /**
   * Ustawia minimalną wysokość placeholdera przed załadowaniem treści.
   */
  public setPlaceholderHeight(height: MaybeSignal<number>): this {
    this._data.placeholderHeight = height;
    return this;
  }
}
