import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpActionToolbarConfig } from '../../molecules/erp-action-toolbar/erp-action-toolbar.types';
import { ErpVisibleRange } from '../../atoms/erp-scroll-viewport/erp-scroll-viewport.types';

/**
 * Komunikat stanu (empty/overflow) — ikona + tekst.
 */
export interface ErpGroupPanelStateMessage {
  /** Ikona wyświetlana nad komunikatem. */
  icon?: MaybeSignal<ErpIcon>;
  /** Treść komunikatu (translatable). */
  message: MaybeSignal<Translatable>;
}

/**
 * Konfiguracja stanu "przepełnienia" — gdy liczba grup przekroczy próg,
 * panel chowa szczegółową wirtualizowaną listę i pokazuje fallback
 * (np. "Zaznaczono zbyt wiele produktów, użyj akcji masowych").
 */
export interface ErpGroupPanelOverflowConfig extends ErpGroupPanelStateMessage {
  /** Próg liczby elementów, powyżej którego pokazywany jest fallback. */
  threshold: number;
}

/**
 * Konfiguracja komponentu ErpGroupPanel.
 *
 * Generyczna kompozycja: pasek akcji (ErpActionToolbar) + wirtualizowana lista
 * grup (ErpScrollViewport) ze stanami empty/overflow. Treść pojedynczej grupy
 * dostarcza wywołujący przez content-projected `<ng-template #erpGroupItem>`.
 *
 * @template TItem Typ elementu grupy (np. produkt, którego dotyczy grupa).
 */
export interface ErpGroupPanelConfig<TItem = any> {
  /** Konfiguracja paska akcji (ErpActionToolbarBuilder). */
  toolbar: ErpActionToolbarConfig;

  /** Lista elementów (grup) do wirtualizacji. */
  items: MaybeSignal<TItem[]>;

  /** Funkcja zwracająca unikalny klucz dla elementu (np. UUID). */
  getItemKey: (index: number, item: TItem) => string;

  /** Szacunkowa wysokość elementu w px (domyślnie 200). */
  estimateSize?: MaybeSignal<number>;

  /** Ilość elementów do pre-renderowania poza viewport (domyślnie 3). */
  overscan?: MaybeSignal<number>;

  /** Callback gdy zakres widocznych elementów się zmieni (np. lazy-load). */
  onRangeChange?: (range: ErpVisibleRange) => void;

  /** Margines scrollu (px) przed początkiem listy. */
  paddingStart?: MaybeSignal<number>;

  /** Margines scrollu (px) za końcem listy. */
  paddingEnd?: MaybeSignal<number>;

  /** Stan pusty — pokazywany gdy `items` jest puste (zamiast toolbara i listy). */
  emptyState?: ErpGroupPanelStateMessage;

  /** Stan przepełnienia — pokazywany zamiast listy, gdy liczba elementów przekroczy próg. */
  overflow?: ErpGroupPanelOverflowConfig;
}
