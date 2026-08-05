import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiDropdown, TuiDialogService } from '@taiga-ui/core';
import { TuiActiveZone } from '@taiga-ui/cdk';
import { unwrapSignal, MaybeSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpButtonComponent } from '../../atoms/erp-button/erp-button.component';
import { ErpButtonConfig } from '../../atoms/erp-button/erp-button.types';
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';
import { ErpActionToolbarConfiguratorComponent } from './erp-action-toolbar-configurator.component';
import { ErpActionToolbarMegaMenuComponent } from './erp-action-toolbar-mega-menu.component';
import { ErpActionToolbarZoneDirective } from './erp-action-toolbar-zone.directive';
import {
  ErpActionDef,
  ErpActionGroup,
  ErpActionToolbarConfig,
  ErpDynamicActionItem,
  ErpDynamicActionProvider,
  ErpToolbarUserPrefs,
} from './erp-action-toolbar.types';

/**
 * ErpActionToolbar — kontekstowe menu akcji z Mega Menu, trybem zaznaczenia,
 * dynamicznymi akcjami, konfiguracją usera i skrótami klawiszowymi.
 *
 * @example
 * ```html
 * <erp-action-toolbar [config]="toolbarConfig" />
 * ```
 */
@Component({
  selector: 'erp-action-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    TuiIcon,
    TuiDropdown,
    TuiActiveZone,
    ErpTranslatePipe,
    ErpButtonComponent,
    ErpActionToolbarMegaMenuComponent,
    ErpActionToolbarConfiguratorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="erp-action-toolbar"
      [class.erp-action-toolbar--selection]="_isSelectionMode()"
      tuiActiveZone
      (tuiActiveZoneChange)="onZoneChange($event)"
    >
      @if (_isSelectionMode()) {
        <!-- ═══ TRYB ZAZNACZENIA ═══ -->
        <div class="erp-action-toolbar__selection-info">
          <tui-icon icon="@tui.check-square" class="erp-action-toolbar__selection-icon" />
          <span class="erp-action-toolbar__selection-text">
            {{ (unwrap(_selectionLabel()) | erpTranslate) || '' }}:
            <strong>{{ _selectionCount() }}</strong>
          </span>
        </div>

        <div class="erp-action-toolbar__separator"></div>

        <!-- Pinned akcje zaznaczenia -->
        <div class="erp-action-toolbar__pinned">
          @for (action of _pinnedSelectionActions(); track action.id) {
            @if (!unwrap(action.hidden)) {
              <erp-button [config]="getButtonConfig(action)" />
            }
          }
        </div>

        <!-- Mega Menu zaznaczenia (jeżeli są dodatkowe) -->
        @if (_hasMoreSelectionActions()) {
          <erp-button
            [config]="_moreButtonConfig()"
            tuiDropdownAuto
            [tuiDropdown]="megaMenuTpl"
            [tuiDropdownOpen]="megaMenuOpen()"
            (tuiDropdownOpenChange)="megaMenuOpen.set($event)"
          />
          <ng-template #megaMenuTpl>
            <erp-action-toolbar-mega-menu
              [groups]="_selectionGroups()"
              [dynamicProviders]="_activeDynamicProviders()"
              [customShortcuts]="_customShortcuts()"
              (actionClick)="onMegaMenuActionClick($event)"
              (dynamicActionClick)="onDynamicAction($event)"
            />
          </ng-template>
        }

        <div class="erp-action-toolbar__spacer"></div>

        @if (isEffectivelyInZone() && _zoneLabel()) {
          <div class="erp-action-toolbar__badge">⌨ {{ _zoneLabel() }}</div>
        }

        <!-- Przycisk „Usuń zaznaczenie" -->
        @if (config().onClearSelection) {
          <erp-button [config]="_clearSelectionButtonConfig" />
        }
      } @else {
        <!-- ═══ TRYB DOMYŚLNY ═══ -->

        <!-- Pinned akcje -->
        <div class="erp-action-toolbar__pinned">
          @for (action of _pinnedDefaultActions(); track action.id) {
            @if (!unwrap(action.hidden)) {
              <erp-button [config]="getButtonConfig(action)" />
            }
          }
        </div>

        <!-- Przycisk „Więcej akcji" → Mega Menu -->
        @if (_hasMoreDefaultActions()) {
          <erp-button
            [config]="_moreButtonConfig()"
            tuiDropdownAuto
            [tuiDropdown]="megaMenuTpl"
            [tuiDropdownOpen]="megaMenuOpen()"
            (tuiDropdownOpenChange)="megaMenuOpen.set($event)"
          />
          <ng-template #megaMenuTpl>
            <erp-action-toolbar-mega-menu
              [groups]="_defaultGroups()"
              [dynamicProviders]="_activeDynamicProviders()"
              [customShortcuts]="_customShortcuts()"
              (actionClick)="onMegaMenuActionClick($event)"
              (dynamicActionClick)="onDynamicAction($event)"
            />
          </ng-template>
        }

        <div class="erp-action-toolbar__spacer"></div>

        @if (isEffectivelyInZone() && _zoneLabel()) {
          <div class="erp-action-toolbar__badge">⌨ {{ _zoneLabel() }}</div>
        }

        <!-- Zębatka konfiguracji -->
        @if (config().showConfigurator !== false) {
          <button
            class="erp-action-toolbar__configurator"
            (click)="openConfigurator(configuratorTpl)"
            title="Konfiguruj menu"
          >
            <tui-icon icon="@tui.settings" />
          </button>
          
          <ng-template #configuratorTpl let-context>
            <erp-action-toolbar-configurator 
              [toolbarConfig]="config()" 
              [dialogContext]="context"
              (closed)="context.complete()" 
            />
          </ng-template>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-action-toolbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--tui-background-base);
      border-bottom: 1px solid var(--tui-border-normal);
      border-radius: 0.5rem;
      min-height: 2.75rem;
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }

    .erp-action-toolbar--selection {
      background: color-mix(in srgb, var(--tui-text-action) 8%, var(--tui-background-base));
      border-color: color-mix(in srgb, var(--tui-text-action) 30%, transparent);
    }

    .erp-action-toolbar--selection ::ng-deep button[tuiButton][appearance="outline"],
    .erp-action-toolbar--selection ::ng-deep button[tuiIconButton][appearance="outline"] {
      background-color: var(--tui-background-base);
      border-color: color-mix(in srgb, var(--tui-text-action) 20%, var(--tui-border-normal));
    }

    .erp-action-toolbar__selection-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .erp-action-toolbar__selection-icon {
      color: var(--tui-text-action);
      font-size: 1.25rem;
    }

    .erp-action-toolbar__selection-text {
      font: var(--tui-font-text-s);
      color: var(--tui-text-primary);
      font-weight: 500;
    }

    .erp-action-toolbar__separator {
      width: 1px;
      align-self: stretch;
      background-color: var(--tui-border-normal);
      margin: 0.25rem 0.25rem;
    }

    .erp-action-toolbar__pinned {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .erp-action-toolbar__spacer {
      flex: 1;
    }

    .erp-action-toolbar__configurator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      background: transparent;
      color: var(--tui-text-secondary);
      cursor: pointer;
      border-radius: 0.375rem;
      transition: background-color 0.15s ease, color 0.15s ease;
      flex-shrink: 0;
    }

    .erp-action-toolbar__configurator:hover {
      background: var(--tui-background-neutral-1-hover);
      color: var(--tui-text-primary);
    }

    .erp-action-toolbar__configurator tui-icon {
      font-size: 1.125rem;
    }

    .erp-action-toolbar__badge {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      background: color-mix(in srgb, var(--tui-text-action) 12%, transparent);
      color: var(--tui-text-action);
      border-radius: 0.25rem;
      pointer-events: none;
      letter-spacing: 0.02em;
      font-family: var(--tui-font-text);
      animation: erpToolbarBadgeFadeIn 0.15s ease;
      white-space: nowrap;
    }

    @keyframes erpToolbarBadgeFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
  `],
})
export class ErpActionToolbarComponent implements OnInit, OnDestroy {
  readonly config = input.required<ErpActionToolbarConfig>();

  private readonly preferencesService = inject(ErpUserPreferencesService);
  private readonly dialogService = inject(TuiDialogService);
  private readonly zoneDirective = inject(ErpActionToolbarZoneDirective, { optional: true });

  /** Stan otwarcia mega menu. */
  protected readonly megaMenuOpen = signal(false);

  /** Czy toolbar jest w aktywnej strefie (mouse hover) z tuiActiveZone na sobie. */
  protected readonly isInZone = signal(false);

  /** Połączony stan hover myszki nad strefą oraz focusu w toolbarze. */
  protected readonly isEffectivelyInZone = computed(() => {
    return this.isInZone() || (this.zoneDirective?.isActive() ?? false);
  });

  protected readonly _zoneLabel = computed(() => this.zoneDirective?.erpActionToolbarZoneLabel() ?? '');

  /** Obsługa skrótów klawiszowych. */
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // ─── Preferencje usera ─────────────────────────

  /** Odczytane preferencje usera dla tego menuId. */
  protected readonly _userPrefs = computed<ErpToolbarUserPrefs | undefined>(() => {
    const menuId = this.config().menuId;
    return this.preferencesService.getState(ErpPreferencesType.ActionToolbar, menuId);
  });

  /** Efektywne ID przypiętych akcji (user prefs > config default). */
  protected readonly _effectivePinnedIds = computed<string[]>(() => {
    const prefs = this._userPrefs();
    if (prefs?.pinnedActionIds?.length) {
      return prefs.pinnedActionIds;
    }
    return this.config().pinnedActionIds ?? [];
  });

  /** Mapa customowych skrótów klawiszowych. */
  protected readonly _customShortcuts = computed<Record<string, string>>(() => {
    return this._userPrefs()?.customShortcuts ?? {};
  });

  // ─── Tryb ─────────────────────────────────────

  protected readonly _selectionCount = computed(() => this.config().selectionCount?.() ?? 0);

  protected readonly _isSelectionMode = computed(() => this._selectionCount() > 0);

  protected readonly _selectionLabel = computed(() =>
    this.config().selectionLabel ?? 'Zaznaczono'
  );

  // ─── Grupy akcji — DEFAULT ──────────────────────

  /** Grupy domyślne po odfiltrowaniu ukrytych. */
  protected readonly _defaultGroups = computed<ErpActionGroup[]>(() => {
    const groups = this.config().defaultGroups;
    const prefs = this._userPrefs();

    if (!prefs) return groups;

    return groups
      .filter(g => !prefs.hiddenGroupIds?.includes(g.id))
      .map(g => ({
        ...g,
        actions: g.actions.filter(a => !prefs.hiddenActionIds?.includes(a.id)),
      }));
  });

  /** Wszystkie akcje z domyślnych grup (flat). */
  private readonly _allDefaultActions = computed<ErpActionDef[]>(() => {
    return this._defaultGroups().flatMap(g => g.actions);
  });

  /** Akcje pinned na pasku (tryb default). */
  protected readonly _pinnedDefaultActions = computed<ErpActionDef[]>(() => {
    const pinnedIds = this._effectivePinnedIds();
    const allActions = this._allDefaultActions();
    return pinnedIds
      .map(id => allActions.find(a => a.id === id))
      .filter((a): a is ErpActionDef => a !== undefined);
  });

  /** Czy są dodatkowe akcje poza pinned (pokaż "Więcej"). */
  protected readonly _hasMoreDefaultActions = computed<boolean>(() => {
    const pinnedIds = this._effectivePinnedIds();
    const allActions = this._allDefaultActions();
    const hasUnpinned = allActions.some(a => !pinnedIds.includes(a.id));
    const hasDynamic = (this.config().dynamicProviders ?? []).length > 0;
    return hasUnpinned || hasDynamic;
  });

  // ─── Grupy akcji — SELECTION ─────────────────────

  protected readonly _selectionGroups = computed<ErpActionGroup[]>(() => {
    return this.config().selectionGroups ?? [];
  });

  private readonly _allSelectionActions = computed<ErpActionDef[]>(() => {
    return this._selectionGroups().flatMap(g => g.actions);
  });

  /** Pinned akcje w trybie zaznaczenia (pierwsze 4 z pierwszej grupy). */
  protected readonly _pinnedSelectionActions = computed<ErpActionDef[]>(() => {
    const actions = this._allSelectionActions();
    return actions.slice(0, 4);
  });

  protected readonly _hasMoreSelectionActions = computed<boolean>(() => {
    const actions = this._allSelectionActions();
    return actions.length > 4;
  });

  // ─── Dynamiczne providery ─────────────────────────

  protected readonly _activeDynamicProviders = computed<ErpDynamicActionProvider[]>(() => {
    const providers = this.config().dynamicProviders ?? [];
    const prefs = this._userPrefs();

    if (!prefs) return providers;

    return providers.filter(dp => {
      const groupPrefs = prefs.dynamicGroupPrefs?.[dp.groupId];
      return !groupPrefs?.hidden;
    });
  });

  // ─── Konfiguracje przycisków ──────────────────────

  protected readonly _moreButtonConfig = computed<ErpButtonConfig>(() => ({
    label: 'Więcej',
    iconEnd: '@tui.chevron-down',
    appearance: 'outline',
    size: 'm',
  }));

  protected readonly _clearSelectionButtonConfig: ErpButtonConfig = {
    label: 'Usuń zaznaczenie',
    iconStart: '@tui.x',
    appearance: 'flat',
    size: 'm',
    fn: () => this.config().onClearSelection?.(),
  };

  protected unwrap<T>(val: MaybeSignal<T> | undefined): T | undefined {
    return unwrapSignal(val);
  }

  protected getButtonConfig(action: ErpActionDef): ErpButtonConfig {
    return {
      label: action.label,
      iconStart: action.icon,
      disabled: action.disabled,
      appearance: this.mapAppearance(action),
      size: 'm',
      fn: action.fn,
    };
  }

  private mapAppearance(action: ErpActionDef): ErpButtonConfig['appearance'] {
    const appearance = unwrapSignal(action.appearance);
    switch (appearance) {
      case 'warning': return 'destructive';
      case 'info': return 'secondary';
      case 'success': return 'accent';
      default: return 'outline';
    }
  }

  // ─── Mega Menu callbacks ──────────────────────────

  protected onMegaMenuActionClick(action: ErpActionDef): void {
    this.megaMenuOpen.set(false);
  }

  protected onDynamicAction(event: { template: ErpActionDef; item: ErpDynamicActionItem }): void {
    this.megaMenuOpen.set(false);
  }

  // ─── Konfiguracja ──────────────────────────────────

  protected openConfigurator(template: any): void {
    this.dialogService.open(template, {
      size: 'l',
      closable: false,
    }).subscribe();
  }

  // ─── Active Zone ──────────────────────────────────

  protected onZoneChange(active: boolean): void {
    this.isInZone.set(active);
  }

  // ─── Keyboard Shortcuts ───────────────────────────

  ngOnInit(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    // Rejestrujemy na document, ale sprawdzamy isInZone
    document.addEventListener('keydown', this.keydownHandler);
  }

  ngOnDestroy(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.isEffectivelyInZone()) return;

    const pressedCombo = this.buildComboString(event);
    if (!pressedCombo) return;

    const allActions = this._isSelectionMode()
      ? this._allSelectionActions()
      : this._allDefaultActions();

    const customs = this._customShortcuts();

    for (const action of allActions) {
      const shortcut = customs[action.id] ?? action.shortcut;
      if (shortcut && this.normalizeShortcut(shortcut) === pressedCombo) {
        event.preventDefault();
        event.stopPropagation();
        if (!unwrapSignal(action.disabled) && action.fn) {
          action.fn();
        }
        return;
      }
    }
  }

  private buildComboString(e: KeyboardEvent): string | null {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    const key = e.key.toLowerCase();
    // Ignoruj samo modyfikatory
    if (['control', 'alt', 'shift', 'meta'].includes(key)) return null;

    parts.push(key);
    return parts.join('+');
  }

  private normalizeShortcut(shortcut: string): string {
    return shortcut
      .toLowerCase()
      .split('+')
      .map(p => p.trim())
      .sort((a, b) => {
        const order = ['ctrl', 'alt', 'shift'];
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      })
      .join('+');
  }
}
