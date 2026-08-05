import { Signal } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import {
  ErpActionDef,
  ErpActionAppearance,
  ErpActionGroup,
  ErpActionToolbarConfig,
  ErpDynamicActionItem,
  ErpDynamicActionProvider,
} from './erp-action-toolbar.types';

// ─────────────────────────────────────────────────
// ErpActionDefBuilder
// ─────────────────────────────────────────────────

/**
 * Builder dla pojedynczej akcji.
 *
 * @example
 * ```ts
 * ErpActionDefBuilder.create(a => a
 *   .setId('add')
 *   .setLabel(KEYS.add)
 *   .setIcon('@tui.plus')
 *   .setShortcut('Ctrl+N')
 *   .setFn(() => this.onAdd())
 * )
 * ```
 */
export class ErpActionDefBuilder extends ErpBaseBuilder<ErpActionDef> {

  /** Ustawia unikalny identyfikator akcji (używany m.in. w preferencjach użytkownika). */
  public setId(id: string): this {
    this._data.id = id;
    return this;
  }

  /** Ustawia etykietę wyświetlaną w menu. Wspiera klucze Transloco (np. KEYS.add). */
  public setLabel(label: MaybeSignal<Translatable>): this {
    this._data.label = label;
    return this;
  }

  /** Ustawia opcjonalną ikonę wyświetlaną obok etykiety (np. '@tui.plus'). */
  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  /** Ustawia podpowiedź (tooltip) po najechaniu myszą na akcję. */
  public setHint(hint: MaybeSignal<Translatable>): this {
    this._data.hint = hint;
    return this;
  }

  /** Ustawia wygląd/stylizację przycisku akcji ('normal', 'warning', 'info', 'success'). */
  public setAppearance(appearance: MaybeSignal<ErpActionAppearance>): this {
    this._data.appearance = appearance;
    return this;
  }

  /** Ustawia stan zablokowania akcji (szary przycisk, brak możliwości kliknięcia). */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  /** Warunkowo ukrywa akcję (programowo, niezależnie od konfiguracji użytkownika). */
  public setHidden(hidden: MaybeSignal<boolean>): this {
    this._data.hidden = hidden;
    return this;
  }

  /** Ustawia domyślny skrót klawiszowy (np. 'Ctrl+N'). Będzie widoczny w menu obok etykiety. */
  public setShortcut(shortcut: string): this {
    this._data.shortcut = shortcut;
    return this;
  }

  /** Ustawia callback wywoływany po kliknięciu akcji. Zwrócenie Promise pokaże loader na przycisku. */
  public setFn(fn: () => void | Promise<void>): this {
    this._data.fn = fn;
    return this;
  }

  /** Ustawia callback dla akcji dynamicznych (otrzymuje w parametrze dane powiązanej instancji). */
  public setDynamicFn(fn: (item: ErpDynamicActionItem) => void | Promise<void>): this {
    this._data.dynamicFn = fn;
    return this;
  }

  /** Dodaje separator (linię oddzielającą) nad tą akcją w Mega Menu. */
  public setSeparator(separator: boolean): this {
    this._data.separator = separator;
    return this;
  }

  /** Ustawia pełną listę zagnieżdżonych pod-akcji. */
  public setChildren(children: (ErpActionDef | ErpActionDefBuilder)[]): this {
    this._data.children = children.map(child => this._extract(child));
    return this;
  }

  /** Dodaje nową zagnieżdżoną pod-akcję za pomocą buildera. */
  public addChild(configure: (builder: ErpActionDefBuilder) => void): this {
    if (!this._data.children) {
      this._data.children = [];
    }
    const builder = new ErpActionDefBuilder();
    configure(builder);
    this._data.children.push(builder.build());
    return this;
  }
}

// ─────────────────────────────────────────────────
// ErpActionGroupBuilder
// ─────────────────────────────────────────────────

/**
 * Builder dla grupy akcji (kolumna w Mega Menu).
 *
 * @example
 * ```ts
 * ErpActionGroupBuilder.create(g => g
 *   .setId('crud')
 *   .setLabel(KEYS.groups.crud)
 *   .setIcon('@tui.layers')
 *   .addAction(a => a.setId('add').setLabel('Dodaj').setFn(() => ...))
 *   .addAction(a => a.setId('delete').setLabel('Usuń').setAppearance('warning'))
 * )
 * ```
 */
export class ErpActionGroupBuilder extends ErpBaseBuilder<ErpActionGroup> {

  constructor() {
    super();
    this._data.actions = [];
  }

  /** Ustawia unikalny identyfikator grupy akcji. */
  public setId(id: string): this {
    this._data.id = id;
    return this;
  }

  /** Ustawia nagłówek grupy widoczny nad kolumną w Mega Menu. */
  public setLabel(label: MaybeSignal<Translatable>): this {
    this._data.label = label;
    return this;
  }

  /** Ustawia opcjonalną ikonę wyświetlaną obok nagłówka grupy. */
  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  /** Oznacza grupę jako dynamiczną (zarządzaną oddzielnie w konfiguratorze użytkownika). */
  public setIsDynamic(isDynamic: boolean): this {
    this._data.isDynamic = isDynamic;
    return this;
  }

  /** Dodaje nową akcję do tej grupy za pomocą buildera. */
  public addAction(configure: (builder: ErpActionDefBuilder) => void): this {
    const builder = new ErpActionDefBuilder();
    configure(builder);
    (this._data.actions as ErpActionDef[]).push(builder.build());
    return this;
  }

  /** Ustawia pełną listę akcji przypisanych do tej grupy. */
  public setActions(actions: (ErpActionDef | ErpActionDefBuilder)[]): this {
    this._data.actions = actions.map(a => this._extract(a));
    return this;
  }
}

// ─────────────────────────────────────────────────
// ErpDynamicProviderBuilder
// ─────────────────────────────────────────────────

/**
 * Builder dla dynamicznego providera akcji.
 *
 * @example
 * ```ts
 * ErpDynamicProviderBuilder.create(dp => dp
 *   .setGroupId('attributes')
 *   .setLabel(KEYS.groups.attributes)
 *   .setItems(this.attributeSignal)
 *   .addTemplateAction(a => a.setId('edit').setLabel('Edytuj').setDynamicFn(item => this.edit(item)))
 *   .addTemplateAction(a => a.setId('delete').setLabel('Usuń').setDynamicFn(item => this.delete(item)))
 * )
 * ```
 */
export class ErpDynamicProviderBuilder extends ErpBaseBuilder<ErpDynamicActionProvider> {

  constructor() {
    super();
    this._data.actionTemplate = [];
  }

  /** Ustawia unikalne ID grupy dynamicznej. */
  public setGroupId(groupId: string): this {
    this._data.groupId = groupId;
    return this;
  }

  /** Ustawia nagłówek grupy widoczny w Mega Menu (np. 'Atrybuty'). */
  public setLabel(label: MaybeSignal<Translatable>): this {
    this._data.label = label;
    return this;
  }

  /** Ustawia ikonę grupy. */
  public setIcon(icon: MaybeSignal<ErpIcon>): this {
    this._data.icon = icon;
    return this;
  }

  /** Ustawia Signal z którego w runtime pobierane będą pozycje (ErpDynamicActionItem). */
  public setItems(items: Signal<ErpDynamicActionItem[]>): this {
    this._data.items = items;
    return this;
  }

  /** Dodaje akcję-szablon, która będzie renderowana pod każdym dynamicznym elementem. */
  public addTemplateAction(configure: (builder: ErpActionDefBuilder) => void): this {
    const builder = new ErpActionDefBuilder();
    configure(builder);
    (this._data.actionTemplate as ErpActionDef[]).push(builder.build());
    return this;
  }

  /** Ustawia pełną listę akcji stanowiących szablon dla dynamicznych elementów. */
  public setActionTemplate(template: (ErpActionDef | ErpActionDefBuilder)[]): this {
    this._data.actionTemplate = template.map(a => this._extract(a));
    return this;
  }
}

// ─────────────────────────────────────────────────
// ErpActionToolbarBuilder
// ─────────────────────────────────────────────────

/**
 * Główny builder konfiguracji toolbara.
 *
 * @example
 * ```ts
 * protected readonly toolbarConfig = ErpActionToolbarBuilder.create(b => b
 *   .setMenuId('product-list-toolbar')
 *   .addDefaultGroup(g => g
 *     .setId('crud')
 *     .setLabel('CRUD')
 *     .addAction(a => a.setId('add').setLabel('Dodaj').setIcon('@tui.plus').setFn(() => this.onAdd()))
 *   )
 *   .addSelectionGroup(g => g
 *     .setId('sel-actions')
 *     .setLabel('Zaznaczone')
 *     .addAction(a => a.setId('bulk-delete').setLabel('Usuń').setAppearance('warning'))
 *   )
 *   .setSelectionCount(this.selectionCount)
 *   .setOnClearSelection(() => this.clearSelection())
 *   .setPinnedActionIds(['add'])
 *   .setShowConfigurator(true)
 * );
 * ```
 */
export class ErpActionToolbarBuilder extends ErpBaseBuilder<ErpActionToolbarConfig> {

  constructor() {
    super();
    this._data.defaultGroups = [];
    this._data.showConfigurator = true;
    this._data.enableContextMenu = false;
  }

  /** Ustawia unikalne ID całego toolbara. Jest to klucz niezbędny do zapisywania preferencji usera w localStorage/DB. */
  public setMenuId(menuId: string): this {
    this._data.menuId = menuId;
    return this;
  }

  /** Dodaje nową grupę akcji, widoczną w trybie domyślnym (gdy zaznaczenie wynosi 0). */
  public addDefaultGroup(configure: (builder: ErpActionGroupBuilder) => void): this {
    const builder = new ErpActionGroupBuilder();
    configure(builder);
    (this._data.defaultGroups as ErpActionGroup[]).push(builder.build());
    return this;
  }

  /** Ustawia wszystkie domyślne grupy akcji, nadpisując obecne. */
  public setDefaultGroups(groups: (ErpActionGroup | ErpActionGroupBuilder)[]): this {
    this._data.defaultGroups = groups.map(g => this._extract(g));
    return this;
  }

  /** Dodaje nową grupę akcji, która pojawi się tylko po zaznaczeniu przynajmniej jednego elementu. */
  public addSelectionGroup(configure: (builder: ErpActionGroupBuilder) => void): this {
    if (!this._data.selectionGroups) {
      this._data.selectionGroups = [];
    }
    const builder = new ErpActionGroupBuilder();
    configure(builder);
    (this._data.selectionGroups as ErpActionGroup[]).push(builder.build());
    return this;
  }

  /** Ustawia wszystkie grupy akcji dla trybu zaznaczenia. */
  public setSelectionGroups(groups: (ErpActionGroup | ErpActionGroupBuilder)[]): this {
    this._data.selectionGroups = groups.map(g => this._extract(g));
    return this;
  }

  /** Dodaje provider dostarczający dynamiczne pozycje do menu (np. ładowane atrybuty z backendu). */
  public addDynamicProvider(configure: (builder: ErpDynamicProviderBuilder) => void): this {
    if (!this._data.dynamicProviders) {
      this._data.dynamicProviders = [];
    }
    const builder = new ErpDynamicProviderBuilder();
    configure(builder);
    (this._data.dynamicProviders as ErpDynamicActionProvider[]).push(builder.build());
    return this;
  }

  /** Podpina Signal przechowujący liczbę zaznaczonych elementów. Powyżej 0 aktywuje się tryb zaznaczenia. */
  public setSelectionCount(count: Signal<number>): this {
    this._data.selectionCount = count;
    return this;
  }

  /** Ustawia etykietę wyświetlaną obok licznika w trybie zaznaczenia (np. 'Wybrano produktów'). */
  public setSelectionLabel(label: MaybeSignal<Translatable>): this {
    this._data.selectionLabel = label;
    return this;
  }

  /** Podpina callback wywoływany po kliknięciu przycisku 'Usuń zaznaczenie'. */
  public setOnClearSelection(fn: () => void): this {
    this._data.onClearSelection = fn;
    return this;
  }

  /** Definiuje tablicę identyfikatorów akcji, które domyślnie są wyciągnięte (przypięte) na główny pasek. */
  public setPinnedActionIds(ids: string[]): this {
    this._data.pinnedActionIds = ids;
    return this;
  }

  /** Pozwala ukryć lub pokazać zębatkę (konfigurator). Domyślnie włączone. */
  public setShowConfigurator(show: boolean): this {
    this._data.showConfigurator = show;
    return this;
  }

  /**
   * Pozwala włączyć dyrektywę Context Menu. Jeśli true, można w widoku użyć [erpActionToolbarContext].
   * Domyślnie false.
   */
  public setEnableContextMenu(enable: boolean): this {
    this._data.enableContextMenu = enable;
    return this;
  }
}
