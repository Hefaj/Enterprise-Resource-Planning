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
  ViewChildren,
  ElementRef,
  QueryList,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiDropdown, TuiDialogService, TuiButton } from '@taiga-ui/core';
import { TuiButtonLoading } from '@taiga-ui/kit';
import { TuiActiveZone } from '@taiga-ui/cdk';
import { unwrapSignal, MaybeSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
// Usunięto importy ErpButtonComponent oraz ErpButtonConfig
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';
import { ErpActionToolbarConfiguratorComponent } from './erp-action-toolbar-configurator.component';
import { ErpActionToolbarMegaMenuComponent } from './erp-action-toolbar-mega-menu.component';
import { ErpActionToolbarZoneDirective } from './erp-action-toolbar-zone.directive';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpSelectionScopeKind } from '../../atoms/erp-table/erp-selection.utils';
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
    TuiButton,
    TuiButtonLoading,
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
          @if (config().onClearSelection) {
            <button
              tuiIconButton
              type="button"
              appearance="flat"
              size="s"
              iconStart="@tui.x"
              [title]="(SHARED_KEYS.actionToolbar.toolbar.clearSelection | erpTranslate) || ''"
              (click)="config().onClearSelection?.()"
              class="erp-action-toolbar__selection-clear"
            >
              Usuń
            </button>
          }
        </div>

        <div class="erp-action-toolbar__separator"></div>

        <!-- Pinned akcje zaznaczenia -->
        <div class="erp-action-toolbar__scroll-wrapper" 
             [class.is-scrollable-left]="scrollableLeft()" 
             [class.is-scrollable-right]="scrollableRight()">
          <div class="erp-action-toolbar__pinned" #scrollContainer (scroll)="onScroll(scrollContainer)">
          @for (action of _pinnedSelectionActions(); track action.id) {
            @if (!unwrap(action.hidden)) {
              <!-- Tooltip siedzi na opakowaniu, nie na przycisku: zablokowany button nie dostaje
                   zdarzeń myszy, więc title postawiony wprost na nim nigdy by się nie pokazał —
                   a podpowiedź jest potrzebna właśnie wtedy, gdy akcja jest zablokowana. -->
              <span
                class="erp-action-toolbar__pinned-item"
                [title]="(unwrap(action.hint) | erpTranslate) || ''"
              >
                <button
                  tuiButton
                  type="button"
                  [appearance]="'flat'"
                  [size]="'m'"
                  [disabled]="unwrap(action.disabled) || isActionLoading(action)"
                  [loading]="isActionLoading(action)"
                  [iconStart]="unwrap(action.icon) ?? ''"
                  (click)="onActionClick(action)"
                  [class.erp-action-toolbar__btn--default]="!unwrap(action.appearance)"
                  [class.erp-action-toolbar__btn--warning]="unwrap(action.appearance) === 'warning'"
                  [class.erp-action-toolbar__btn--info]="unwrap(action.appearance) === 'info'"
                  [class.erp-action-toolbar__btn--success]="unwrap(action.appearance) === 'success'"
                >
                  <span>{{ (unwrap(action.label) | erpTranslate) || '' }}</span>
                </button>
              </span>
            }
          }
          </div>
        </div>

        <!-- Mega Menu zaznaczenia (jeżeli są dodatkowe) -->
        @if (_hasMoreSelectionActions()) {
          <button
            tuiButton
            type="button"
            appearance="flat"
            size="m"
            iconEnd="@tui.chevron-down"
            tuiDropdownAuto
            [tuiDropdown]="megaMenuTpl"
            [tuiDropdownOpen]="megaMenuOpen()"
            (tuiDropdownOpenChange)="megaMenuOpen.set($event)"
          >
            <span>{{ (SHARED_KEYS.actionToolbar.toolbar.more | erpTranslate) || '' }}</span>
          </button>
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


      } @else {
        <!-- ═══ TRYB DOMYŚLNY ═══ -->

        <!-- Pinned akcje -->
        <div class="erp-action-toolbar__scroll-wrapper" 
             [class.is-scrollable-left]="scrollableLeft()" 
             [class.is-scrollable-right]="scrollableRight()">
          <div class="erp-action-toolbar__pinned" #scrollContainer (scroll)="onScroll(scrollContainer)">
          @for (action of _pinnedDefaultActions(); track action.id) {
            @if (!unwrap(action.hidden)) {
              <!-- Tooltip siedzi na opakowaniu, nie na przycisku: zablokowany button nie dostaje
                   zdarzeń myszy, więc title postawiony wprost na nim nigdy by się nie pokazał —
                   a podpowiedź jest potrzebna właśnie wtedy, gdy akcja jest zablokowana. -->
              <span
                class="erp-action-toolbar__pinned-item"
                [title]="(unwrap(action.hint) | erpTranslate) || ''"
              >
                <button
                  tuiButton
                  type="button"
                  [appearance]="'flat'"
                  [size]="'m'"
                  [disabled]="unwrap(action.disabled) || isActionLoading(action)"
                  [loading]="isActionLoading(action)"
                  [iconStart]="unwrap(action.icon) ?? ''"
                  (click)="onActionClick(action)"
                  [class.erp-action-toolbar__btn--default]="!unwrap(action.appearance)"
                  [class.erp-action-toolbar__btn--warning]="unwrap(action.appearance) === 'warning'"
                  [class.erp-action-toolbar__btn--info]="unwrap(action.appearance) === 'info'"
                  [class.erp-action-toolbar__btn--success]="unwrap(action.appearance) === 'success'"
                >
                  <span>{{ (unwrap(action.label) | erpTranslate) || '' }}</span>
                </button>
              </span>
            }
          }
          </div>
        </div>

        <!-- Przycisk „Więcej akcji" → Mega Menu -->
        @if (_hasMoreDefaultActions()) {
          <button
            tuiButton
            type="button"
            appearance="flat"
            size="m"
            iconEnd="@tui.chevron-down"
            tuiDropdownAuto
            [tuiDropdown]="megaMenuTpl"
            [tuiDropdownOpen]="megaMenuOpen()"
            (tuiDropdownOpenChange)="megaMenuOpen.set($event)"
          >
            <span>{{ (SHARED_KEYS.actionToolbar.toolbar.more | erpTranslate) || '' }}</span>
          </button>
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

      }

      <!-- WSPÓLNA CZĘŚĆ (Prawa strona) -->
      <div class="erp-action-toolbar__spacer"></div>

      <!-- Zębatka konfiguracji -->
      @if (config().showConfigurator !== false) {
        <button
          class="erp-action-toolbar__configurator"
          (click)="openConfigurator(configuratorTpl)"
          [title]="(SHARED_KEYS.actionToolbar.toolbar.configureMenu | erpTranslate) || ''"
        >
          <tui-icon icon="@tui.settings" />
        </button>
        
        <ng-template #configuratorTpl let-context>
          <erp-action-toolbar-configurator 
            [toolbarConfig]="config()" 
            [dialogContext]="context"
            [initialTab]="_isSelectionMode() ? 1 : 0"
            (closed)="context.complete()" 
          />
        </ng-template>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-action-toolbar {
      --erp-toolbar-bg: var(--tui-background-elevation-1);
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
      --erp-toolbar-bg: color-mix(in srgb, var(--tui-text-action) 8%, var(--tui-background-base));
      background: var(--erp-toolbar-bg);
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

    .erp-action-toolbar__selection-clear {
      margin-left: 0.25rem;
      color: var(--tui-text-primary);
    }

    .erp-action-toolbar__separator {
      width: 1px;
      align-self: stretch;
      background-color: var(--tui-border-normal);
      margin: 0.25rem 0.25rem;
    }
    
    .erp-action-toolbar__scroll-wrapper {
      display: flex;
      position: relative;
      min-width: 0;
    }

    .erp-action-toolbar__scroll-wrapper::before,
    .erp-action-toolbar__scroll-wrapper::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 16px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 1;
    }

    .erp-action-toolbar__scroll-wrapper::before {
      left: 0;
      background: linear-gradient(to right, var(--erp-toolbar-bg), transparent);
    }

    .erp-action-toolbar__scroll-wrapper::after {
      right: 0;
      background: linear-gradient(to left, var(--erp-toolbar-bg), transparent);
    }

    .erp-action-toolbar__scroll-wrapper.is-scrollable-left::before {
      opacity: 1;
    }

    .erp-action-toolbar__scroll-wrapper.is-scrollable-right::after {
      opacity: 1;
    }

    .erp-action-toolbar__pinned {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .erp-action-toolbar__pinned::-webkit-scrollbar {
      display: none;
    }

    .erp-action-toolbar__pinned button {
      flex-shrink: 0;
    }

    .erp-action-toolbar__pinned-item {
      display: inline-flex;
      flex-shrink: 0;
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

    .erp-action-toolbar__btn--default {
      --tui-text-action: var(--tui-text-primary);
      --tui-text-action-hover: var(--tui-text-primary);
    }
    
    .erp-action-toolbar__btn--warning {
      --tui-text-primary: var(--tui-text-negative);
      --tui-text-action: var(--tui-text-negative);
      --tui-text-action-hover: var(--tui-text-negative-hover, var(--tui-text-negative));
    }

    .erp-action-toolbar__btn--info {
      --tui-text-primary: var(--tui-text-action);
    }

    .erp-action-toolbar__btn--success {
      --tui-text-primary: var(--tui-status-positive);
      --tui-text-action: var(--tui-status-positive);
      --tui-text-action-hover: var(--tui-status-positive-hover, var(--tui-status-positive));
    }
  `],
})
export class ErpActionToolbarComponent implements OnInit, OnDestroy {
  protected readonly SHARED_KEYS = SHARED_KEYS;
  
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
    this.config().selectionLabel ?? SHARED_KEYS.actionToolbar.toolbar.selected
  );

  // ─── Zasięg zaznaczenia ─────────────────────────

  /**
   * Rodzaj zasięgu, w którym pracuje toolbar. Brak konfiguracji = `explicit`, czyli
   * zachowanie sprzed wprowadzenia zasięgów (żadna akcja nie jest blokowana).
   */
  protected readonly _scopeKind = computed<ErpSelectionScopeKind>(
    () => this.config().selectionScope?.() ?? 'explicit'
  );

  /**
   * Blokuje akcje, których `scopes` nie obejmuje bieżącego zasięgu — świadomie przez `disabled`
   * + `hint`, nie przez ukrycie: znikające przyciski rozjeżdżają układ, który user sam sobie
   * przypiął, i nie tłumaczą, dlaczego akcja przepadła.
   *
   * Dekoracja robiona jest na poziomie grup, więc dotyczy jednocześnie przypiętych przycisków,
   * Mega Menu i skrótów klawiszowych (te sprawdzają `action.disabled`).
   */
  private _applyScopeGate(actions: ErpActionDef[]): ErpActionDef[] {
    const kind = this._scopeKind();

    return actions.map(action => {
      const children = action.children ? this._applyScopeGate(action.children) : undefined;
      const blocked = action.scopes !== undefined && !action.scopes.includes(kind);

      if (!blocked) {
        return children ? { ...action, children } : action;
      }

      return {
        ...action,
        children,
        disabled: true,
        hint: action.unavailableHint ?? SHARED_KEYS.actionToolbar.toolbar.unavailableInScope,
      };
    });
  }

  /** Wspólna ścieżka: preferencje usera (ukrywanie) + bramka zasięgu. */
  private _prepareGroups(groups: ErpActionGroup[]): ErpActionGroup[] {
    const prefs = this._userPrefs();

    return groups
      .filter(g => !prefs?.hiddenGroupIds?.includes(g.id))
      .map(g => ({
        ...g,
        actions: this._applyScopeGate(
          prefs ? g.actions.filter(a => !prefs.hiddenActionIds?.includes(a.id)) : g.actions
        ),
      }));
  }

  // ─── Grupy akcji — DEFAULT ──────────────────────

  /** Grupy domyślne po odfiltrowaniu ukrytych i zablokowaniu niedostępnych w bieżącym zasięgu. */
  protected readonly _defaultGroups = computed<ErpActionGroup[]>(() =>
    this._prepareGroups(this.config().defaultGroups)
  );

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

  protected readonly _selectionGroups = computed<ErpActionGroup[]>(() =>
    this._prepareGroups(this.config().selectionGroups ?? [])
  );

  private readonly _allSelectionActions = computed<ErpActionDef[]>(() => {
    return this._selectionGroups().flatMap(g => g.actions);
  });

  /** Pinned akcje w trybie zaznaczenia. */
  protected readonly _pinnedSelectionActions = computed<ErpActionDef[]>(() => {
    const pinnedIds = this._effectivePinnedIds();
    const allActions = this._allSelectionActions();
    return pinnedIds
      .map(id => allActions.find(a => a.id === id))
      .filter((a): a is ErpActionDef => a !== undefined);
  });

  protected readonly _hasMoreSelectionActions = computed<boolean>(() => {
    const pinnedIds = this._effectivePinnedIds();
    const allActions = this._allSelectionActions();
    const hasUnpinned = allActions.some(a => !pinnedIds.includes(a.id));
    const hasDynamic = (this.config().dynamicProviders ?? []).length > 0;
    return hasUnpinned || hasDynamic;
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


  protected readonly loadingActions = signal<Set<string>>(new Set());

  protected unwrap<T>(val: MaybeSignal<T> | undefined): T | undefined {
    return unwrapSignal(val);
  }

  protected isActionLoading(action: ErpActionDef): boolean {
    return this.loadingActions().has(action.id);
  }

  protected async onActionClick(action: ErpActionDef): Promise<void> {
    if (unwrapSignal(action.disabled)) return;
    const fn = action.fn;
    if (!fn) return;

    if (this.isActionLoading(action)) return;

    const result = fn();
    if (result instanceof Promise) {
      this.loadingActions.update(s => new Set(s).add(action.id));
      try {
        await result;
      } finally {
        this.loadingActions.update(s => {
          const next = new Set(s);
          next.delete(action.id);
          return next;
        });
      }
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
  
  @ViewChildren('scrollContainer') scrollContainers!: QueryList<ElementRef<HTMLElement>>;
  
  protected scrollableLeft = signal(false);
  protected scrollableRight = signal(false);
  
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    document.addEventListener('keydown', this.keydownHandler);
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.checkScroll());
      this.scrollContainers.changes.subscribe(() => this.updateObserver());
      this.updateObserver();
    }
  }

  private updateObserver(): void {
    this.resizeObserver?.disconnect();
    this.scrollContainers.forEach(c => this.resizeObserver?.observe(c.nativeElement));
    this.checkScroll();
  }

  @HostListener('window:resize')
  protected checkScroll(): void {
    const el = this.scrollContainers?.first?.nativeElement;
    if (el) this.onScroll(el);
  }

  protected onScroll(el: HTMLElement): void {
    this.scrollableLeft.set(el.scrollLeft > 0);
    this.scrollableRight.set(Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
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
