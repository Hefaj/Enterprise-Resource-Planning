import { Signal } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

// ─────────────────────────────────────────────────
// Akcja
// ─────────────────────────────────────────────────

/**
 * Wygląd akcji w menu.
 */
export type ErpActionAppearance = 'normal' | 'warning' | 'info' | 'success';

/**
 * Definicja pojedynczej akcji w toolbarze.
 */
export interface ErpActionDef {
  /** Unikalny identyfikator akcji (używany w preferencjach usera). */
  id: string;

  /** Etykieta wyświetlana w menu. Wspiera Transloco. */
  label: MaybeSignal<Translatable>;

  /** Ikona początkowa. */
  icon?: MaybeSignal<ErpIcon>;

  /** Tooltip/hint. */
  hint?: MaybeSignal<Translatable>;

  /** Wygląd/stylizacja elementu. */
  appearance?: MaybeSignal<ErpActionAppearance>;

  /** Stan zablokowania. */
  disabled?: MaybeSignal<boolean>;

  /** Warunkowe ukrywanie (programowe, nie przez preferencje usera). */
  hidden?: MaybeSignal<boolean>;

  /** Domyślny skrót klawiszowy widoczny w menu (np. 'Ctrl+N'). */
  shortcut?: string;

  /** Callback wywoływany po kliknięciu. Może być async. */
  fn?: () => void | Promise<void>;

  /**
   * Callback wywoływany dla akcji dynamicznych.
   * Przekazuje dane dynamicznej instancji (np. atrybut produktu).
   */
  dynamicFn?: (item: ErpDynamicActionItem) => void | Promise<void>;

  /** Zagnieżdżone akcje (podmenu). */
  children?: ErpActionDef[];

  /** Separator nad tym elementem. */
  separator?: boolean;
}

// ─────────────────────────────────────────────────
// Grupa akcji
// ─────────────────────────────────────────────────

/**
 * Grupa tematyczna akcji wyświetlana jako kolumna w Mega Menu.
 */
export interface ErpActionGroup {
  /** Unikalny identyfikator grupy. */
  id: string;

  /** Nagłówek grupy. */
  label: MaybeSignal<Translatable>;

  /** Opcjonalna ikona grupy. */
  icon?: MaybeSignal<ErpIcon>;

  /** Akcje w grupie. */
  actions: ErpActionDef[];

  /**
   * Oznacza grupę jako dynamiczną.
   * Dynamiczne grupy w konfiguracji usera pozwalają ukrywać sub-akcje,
   * ale nie konkretne instancje (bo pula jest zmienna w runtime).
   */
  isDynamic?: boolean;

  /**
   * Wyklucza grupę z wyszukiwania w Mega Menu.
   * Używane np. dla grupy "Przypięte" — jej akcje są duplikatem akcji
   * z innych grup, więc podczas wyszukiwania nie powinny się dublować w wynikach.
   */
  excludeFromSearch?: boolean;
}

// ─────────────────────────────────────────────────
// Dynamiczne akcje (runtime)
// ─────────────────────────────────────────────────

/**
 * Pojedyncza dynamiczna instancja (np. atrybut produktu "Rozmiar opony").
 */
export interface ErpDynamicActionItem {
  /** Unikalny identyfikator instancji. */
  id: string;

  /** Etykieta wyświetlana w menu. */
  label: string;

  /** Opcjonalna ikona. */
  icon?: ErpIcon;

  /** Dane kontekstowe (np. obiekt atrybutu). */
  data?: any;
}

/**
 * Provider dynamicznych akcji.
 * Definiuje grupę, której instancje ładowane są z Signal w runtime.
 */
export interface ErpDynamicActionProvider {
  /** ID grupy. */
  groupId: string;

  /** Nagłówek grupy dynamicznej. */
  label: MaybeSignal<Translatable>;

  /** Ikona grupy. */
  icon?: MaybeSignal<ErpIcon>;

  /** Signal zwracający aktualną listę instancji. */
  items: Signal<ErpDynamicActionItem[]>;

  /**
   * Szablon sub-akcji stosowany do każdej dynamicznej instancji.
   * Np. [Edytuj, Usuń] — te same opcje pod każdą instancją.
   */
  actionTemplate: ErpActionDef[];
}

// ─────────────────────────────────────────────────
// Preferencje użytkownika
// ─────────────────────────────────────────────────

/**
 * Preferencje dynamicznej grupy — co user ukrył/zostawił.
 */
export interface ErpDynamicGroupPrefs {
  /** Czy cała grupa jest ukryta. */
  hidden: boolean;

  /** Identyfikatory sub-akcji ukrytych przez usera. */
  hiddenSubActionIds: string[];
}

/**
 * Preferencje użytkownika dla konkretnego toolbara.
 * Zapisywane w `ErpUserPreferencesService` pod kluczem `actionToolbars[menuId]`.
 */
export interface ErpToolbarUserPrefs {
  /** ID akcji ukrytych przez usera w mega menu. */
  hiddenActionIds: string[];

  /** ID akcji przypiętych na pasku (kolejność ma znaczenie!). */
  pinnedActionIds: string[];

  /** ID grup ukrytych przez usera. */
  hiddenGroupIds: string[];

  /** Preferencje dynamicznych grup. */
  dynamicGroupPrefs: Record<string, ErpDynamicGroupPrefs>;

  /**
   * Skróty klawiszowe przypisane przez usera (nadpisują domyślne).
   * Klucz = actionId, wartość = shortcut string (np. 'Ctrl+Shift+E').
   */
  customShortcuts: Record<string, string>;
}

// ─────────────────────────────────────────────────
// Konfiguracja toolbara (input komponentu)
// ─────────────────────────────────────────────────

/**
 * Główna konfiguracja komponentu ErpActionToolbar.
 */
export interface ErpActionToolbarConfig {
  /**
   * Unikalny identyfikator menu. Używany jako klucz w preferencjach usera.
   * Np. 'product-list-toolbar', 'multimedia-panel-toolbar'.
   */
  menuId: string;

  /** Akcje wyświetlane domyślnie (brak zaznaczenia). */
  defaultGroups: ErpActionGroup[];

  /** Akcje wyświetlane w trybie zaznaczenia. */
  selectionGroups?: ErpActionGroup[];

  /** Dynamiczne providery akcji. */
  dynamicProviders?: ErpDynamicActionProvider[];

  /** Signal z liczbą zaznaczonych elementów. 0 = tryb domyślny. */
  selectionCount?: Signal<number>;

  /** Etykieta zaznaczenia (domyślna: 'shared.selectionToolbar.selected'). */
  selectionLabel?: MaybeSignal<Translatable>;

  /** Callback usuwania zaznaczenia. */
  onClearSelection?: () => void;

  /**
   * Domyślne ID akcji przypiętych na pasku (widoczne jako przyciski).
   * User może je zmienić w konfiguratorze.
   */
  pinnedActionIds?: string[];

  /** Czy pokazywać zębatkę konfiguracji. Domyślnie true. */
  showConfigurator?: boolean;

  /** Czy włączyć obsługę context menu (PPM). Domyślnie false. */
  enableContextMenu?: boolean;

  /**
   * Czy kliknięcie w backdrop (tło) menu kontekstowego powinno być przekazane
   * do elementu pod kursorem (np. wiersz tabeli).
   * Domyślnie true — klik zamyka menu i jednocześnie zaznacza wiersz.
   * false — klik zamyka menu, element pod spodem NIE dostaje zdarzenia (obecne zachowanie).
   */
  backdropClickThrough?: boolean;
}
