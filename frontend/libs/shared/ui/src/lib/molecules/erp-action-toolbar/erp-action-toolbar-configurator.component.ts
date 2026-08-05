import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { TuiIcon } from '@taiga-ui/core';
import { TuiTabs } from '@taiga-ui/kit';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { unwrapSignal, MaybeSignal } from '../../base/erp-signal-utils';
import { ErpButtonComponent } from '../../atoms/erp-button/erp-button.component';
import { ErpButtonConfig } from '../../atoms/erp-button/erp-button.types';
import { ErpInputComponent, ErpInputBuilder } from '../../form/erp-input';
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';
import {
  ErpActionDef,
  ErpActionGroup,
  ErpActionToolbarConfig,
  ErpDynamicActionProvider,
  ErpToolbarUserPrefs,
  ErpDynamicGroupPrefs,
} from './erp-action-toolbar.types';

/** Element w liście konfiguracji. */
interface ConfiguratorItem {
  id: string;
  label: string;
  icon?: string;
  type: 'group' | 'action' | 'dynamic-group' | 'dynamic-sub-action';
  groupId?: string;
  enabled: boolean;
  pinned: boolean;
  shortcut: string;
  defaultShortcut: string;
  indent: number;
  isSelectionGroup?: boolean;
}

/**
 * Komponent konfiguracji toolbara (modal/panel).
 * Pozwala userowi:
 * - Ukryć/pokazać grupy i akcje
 * - Przypiąć akcje na pasek (pinned)
 * - Zmienić kolejność pinned akcji
 * - Przypisać własne skróty klawiszowe
 * - Zresetować do domyślnych ustawień
 */
@Component({
  selector: 'erp-action-toolbar-configurator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    TuiIcon,
    TuiTabs,
    TuiHintDirective,
    ErpButtonComponent,
    ErpInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-configurator" [class.erp-configurator--maximized]="maximized()">
      <!-- Header -->
      <div class="erp-configurator__header">
        <tui-icon icon="@tui.settings" class="erp-configurator__header-icon" />
        <h2 class="erp-configurator__title">Konfiguracja paska akcji</h2>
        <button
          class="erp-configurator__maximize"
          (click)="toggleMaximize()"
          [title]="maximized() ? 'Przywróć rozmiar' : 'Maksymalizuj'"
        >
          <tui-icon [icon]="maximized() ? '@tui.minimize-2' : '@tui.maximize-2'" />
        </button>
        <button
          class="erp-configurator__close"
          (click)="onClose()"
          title="Zamknij"
        >
          <tui-icon icon="@tui.x" />
        </button>
      </div>

      <!-- Ciało — dwa panele -->
      <div class="erp-configurator__body">
        <!-- Panel lewy: Dostępne akcje -->
        <div class="erp-configurator__panel erp-configurator__panel--left">
          <div class="erp-configurator__panel-tabs">
            <tui-tabs [(activeItemIndex)]="activeTab">
              <button tuiTab type="button">Standardowe</button>
              <button tuiTab type="button">Zaznaczenie</button>
            </tui-tabs>
          </div>

          <div class="erp-configurator__search">
            <erp-input
              [config]="searchInputConfig"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          </div>

          <div class="erp-configurator__list">
            @for (item of _filteredConfiguratorItems(); track item.id + item.type) {
              <div
                class="erp-configurator__item"
                [style.padding-left.rem]="0.75 + item.indent * 1"
                [class.erp-configurator__item--group]="item.type === 'group' || item.type === 'dynamic-group'"
              >
                <!-- Checkbox widoczność -->
                <label class="erp-configurator__checkbox-label">
                  <input
                    type="checkbox"
                    [checked]="item.enabled"
                    (change)="toggleItemEnabled(item)"
                    class="erp-configurator__checkbox"
                  />

                  @if (item.icon) {
                    <tui-icon [icon]="item.icon" class="erp-configurator__item-icon" />
                  }

                  <span class="erp-configurator__item-label"
                    [class.erp-configurator__item-label--group]="item.type === 'group' || item.type === 'dynamic-group'"
                    [tuiHint]="item.label"
                  >
                    {{ item.label }}
                  </span>

                  @if (item.type === 'dynamic-group') {
                    <span class="erp-configurator__dynamic-badge">dyn.</span>
                  }
                </label>

                <!-- Pin na pasek (tylko akcje) -->
                @if (item.type === 'action' && item.enabled) {
                  <button
                    class="erp-configurator__pin-btn"
                    [class.erp-configurator__pin-btn--active]="item.pinned"
                    (click)="togglePinned(item)"
                    title="Przypnij na pasek"
                  >
                    <tui-icon icon="@tui.pin" />
                  </button>
                }

                <!-- Skrót klawiszowy (tylko akcje) -->
                @if (item.type === 'action' || item.type === 'dynamic-sub-action') {
                  <div class="erp-configurator__shortcut-wrapper">
                    <input
                      type="text"
                      class="erp-configurator__shortcut-input"
                      [value]="item.shortcut"
                      (keydown)="captureShortcut($event, item)"
                      (blur)="onShortcutBlur(item)"
                      placeholder="–"
                      readonly
                    />
                    @if (item.shortcut && item.shortcut !== item.defaultShortcut) {
                      <button
                        class="erp-configurator__shortcut-reset"
                        (click)="resetShortcut(item)"
                        title="Resetuj skrót"
                      >
                        <tui-icon icon="@tui.rotate-ccw" />
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Panel prawy: Pinned akcje -->
        <div class="erp-configurator__panel erp-configurator__panel--right">
          <div class="erp-configurator__panel-header">Przypięte na pasku</div>

          <div class="erp-configurator__list" cdkDropList (cdkDropListDropped)="dropPinned($event)">
            @for (item of _pinnedItems(); track item.id; let i = $index) {
              <div class="erp-configurator__pinned-item" cdkDrag>
                <span class="erp-configurator__pinned-index">{{ i + 1 }}.</span>

                @if (item.icon) {
                  <tui-icon [icon]="item.icon" class="erp-configurator__item-icon" />
                }

                <span class="erp-configurator__pinned-label" [tuiHint]="item.label">{{ item.label }}</span>

                <div class="erp-configurator__pinned-controls">
                  <button class="erp-configurator__drag-handle" cdkDragHandle title="Przeciągnij">
                    <tui-icon icon="@tui.grip-vertical" />
                  </button>
                  <button
                    class="erp-configurator__remove-btn"
                    (click)="removePinned(item.id)"
                    title="Odepnij"
                  >
                    <tui-icon icon="@tui.x" />
                  </button>
                </div>
              </div>
            }

            @if (_pinnedItems().length === 0) {
              <div class="erp-configurator__empty">
                Brak przypiętych akcji. Użyj ikony 📌 aby przypiąć.
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="erp-configurator__footer">
        <erp-button [config]="_resetButtonConfig" />
        <div class="erp-configurator__footer-spacer"></div>
        <erp-button [config]="_cancelButtonConfig" />
        <erp-button [config]="_saveButtonConfig" />
      </div>
    </div>
  `,
  styles: [`
    .erp-configurator {
      display: flex;
      flex-direction: column;
      width: calc(100% + 2 * var(--tui-padding, 1.5rem));
      margin: calc(-1 * var(--tui-padding, 1.5rem));
      max-width: 90vw;
      height: 60vh;
    }

    .erp-configurator--maximized {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      max-width: none;
      max-height: none;
      margin: 0;
      border-radius: 0;
      z-index: 9999;
      background: var(--tui-background-base);
    }

    .erp-configurator__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .erp-configurator__header-icon {
      color: var(--tui-text-secondary);
    }

    .erp-configurator__title {
      font: var(--tui-font-text-l);
      font-weight: 600;
      flex: 1;
    }

    .erp-configurator__maximize,
    .erp-configurator__close {
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
    }

    .erp-configurator__maximize:hover,
    .erp-configurator__close:hover {
      background: var(--tui-background-neutral-1-hover);
      color: var(--tui-text-primary);
    }

    .erp-configurator__body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .erp-configurator__panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    .erp-configurator__panel--left {
      border-right: 1px solid var(--tui-border-normal);
    }

    .erp-configurator__panel-tabs {
      border-bottom: 1px solid var(--tui-border-normal);
      padding: 0 0.5rem;
    }

    .erp-configurator__panel-header {
      padding: 0.625rem 0.75rem;
      font: var(--tui-font-text-s);
      font-weight: 700;
      color: var(--tui-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.6875rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .erp-configurator__search {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .erp-configurator__list {
      flex: 1;
      overflow-y: auto;
      padding: 0.25rem 0;
    }

    .erp-configurator__item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      min-height: 2rem;
    }

    .erp-configurator__item--group {
      padding-top: 0.5rem;
    }

    .erp-configurator__checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex: 1;
      cursor: pointer;
      min-width: 0;
    }

    .erp-configurator__checkbox {
      flex-shrink: 0;
      accent-color: var(--tui-text-action);
    }

    .erp-configurator__item-icon {
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
      flex-shrink: 0;
    }

    .erp-configurator__item-label {
      flex: 1;
      font: var(--tui-font-text-s);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .erp-configurator__item-label--group {
      font-weight: 700;
      color: var(--tui-text-primary);
    }

    .erp-configurator__dynamic-badge {
      font-size: 0.5625rem;
      padding: 0.0625rem 0.375rem;
      background: var(--tui-status-info-pale);
      color: var(--tui-status-info);
      border-radius: 0.25rem;
      font-weight: 600;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .erp-configurator__pin-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      background: transparent;
      color: var(--tui-text-tertiary);
      cursor: pointer;
      border-radius: 0.25rem;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }

    .erp-configurator__pin-btn:hover {
      background: var(--tui-background-neutral-1-hover);
    }

    .erp-configurator__pin-btn--active {
      color: var(--tui-text-action);
    }

    .erp-configurator__pin-btn tui-icon {
      font-size: 0.75rem;
    }

    .erp-configurator__shortcut-wrapper {
      display: flex;
      align-items: center;
      gap: 0.125rem;
      flex-shrink: 0;
    }

    .erp-configurator__shortcut-input {
      width: 5.5rem;
      font-size: 0.6875rem;
      padding: 0.125rem 0.375rem;
      background: var(--tui-background-neutral-1);
      color: var(--tui-text-secondary);
      border-radius: 0.25rem;
      border: 1px solid var(--tui-border-normal);
      font-family: var(--tui-font-text);
      text-align: center;
      cursor: pointer;
      outline: none;
    }

    .erp-configurator__shortcut-input:focus {
      border-color: var(--tui-text-action);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--tui-text-action) 20%, transparent);
    }

    .erp-configurator__shortcut-reset {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border: none;
      background: transparent;
      color: var(--tui-text-tertiary);
      cursor: pointer;
      border-radius: 0.25rem;
    }

    .erp-configurator__shortcut-reset tui-icon {
      font-size: 0.625rem;
    }

    .erp-configurator__pinned-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
    }

    .erp-configurator__pinned-index {
      font: var(--tui-font-text-s);
      color: var(--tui-text-tertiary);
      width: 1.25rem;
      text-align: right;
      flex-shrink: 0;
    }

    .erp-configurator__pinned-label {
      flex: 1;
      font: var(--tui-font-text-s);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .erp-configurator__pinned-controls {
      display: flex;
      gap: 0.125rem;
      flex-shrink: 0;
    }

    .erp-configurator__move-btn,
    .erp-configurator__remove-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      background: transparent;
      color: var(--tui-text-tertiary);
      cursor: pointer;
      border-radius: 0.25rem;
    }

    .erp-configurator__move-btn:hover:not(:disabled),
    .erp-configurator__remove-btn:hover {
      background: var(--tui-background-neutral-1-hover);
      color: var(--tui-text-secondary);
    }

    .erp-configurator__move-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .erp-configurator__move-btn tui-icon,
    .erp-configurator__remove-btn tui-icon {
      font-size: 0.75rem;
    }

    .erp-configurator__remove-btn:hover {
      color: var(--tui-text-negative);
    }

    .erp-configurator__empty {
      padding: 1.5rem 0.75rem;
      color: var(--tui-text-tertiary);
      font: var(--tui-font-text-s);
      text-align: center;
      font-style: italic;
    }

    .erp-configurator__footer {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-top: 1px solid var(--tui-border-normal);
    }

    .erp-configurator__footer-spacer {
      flex: 1;
    }
    .erp-configurator__drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      background: transparent;
      color: var(--tui-text-tertiary);
      cursor: grab;
      border-radius: 0.25rem;
    }

    .erp-configurator__drag-handle:active {
      cursor: grabbing;
    }

    .erp-configurator__drag-handle:hover {
      color: var(--tui-text-primary);
      background: var(--tui-background-neutral-1-hover);
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 0.5rem;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
      background: var(--tui-background-base);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .cdk-drag-placeholder {
      opacity: 0.4;
      background: var(--tui-background-neutral-1) !important;
      border: 1px dashed var(--tui-border-focus) !important;
      box-shadow: none !important;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .erp-configurator__list.cdk-drop-list-dragging .erp-configurator__pinned-item:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `],
})
export class ErpActionToolbarConfiguratorComponent implements OnInit {
  /** Konfiguracja toolbara (z definicjami akcji). */
  readonly toolbarConfig = input.required<ErpActionToolbarConfig>();

  /** Dialog context for manipulating dialog size. */
  readonly dialogContext = input<any>();

  /** Emitowane po zamknięciu. */
  readonly closed = output<void>();

  /** Emitowane po zapisaniu. */
  readonly saved = output<ErpToolbarUserPrefs>();

  /** Domyślna zakładka do otwarcia (0 = domyślna, 1 = zaznaczenie). */
  readonly initialTab = input<number>(0);

  private readonly preferencesService = inject(ErpUserPreferencesService);

  // ─── Stan wewnętrzny ──────────────────────────────

  /** Mapa id → enabled (grupy + akcje). */
  private readonly enabledMap = signal<Record<string, boolean>>({});

  /** Lista pinned ids (kolejność!). */
  private readonly pinnedIds = signal<string[]>([]);

  /** Mapa id → shortcut. */
  private readonly shortcutMap = signal<Record<string, string>>({});

  /** Mapa groupId → hidden (dynamic groups). */
  private readonly dynamicGroupHidden = signal<Record<string, boolean>>({});

  /** Mapa groupId → { subActionId: hidden } (dynamic sub-actions). */
  private readonly dynamicSubHidden = signal<Record<string, Record<string, boolean>>>({});

  private initialized = false;

  protected readonly activeTab = signal(0);
  protected readonly maximized = signal(false);

  protected toggleMaximize(): void {
    const next = !this.maximized();
    this.maximized.set(next);
    const context = this.dialogContext();
    if (context) {
      context.size = next ? 'page' : 'l';
    }
  }

  protected readonly searchTerm = signal('');
  
  protected readonly searchInputConfig = ErpInputBuilder.create(b => b
    .setIconStart('@tui.search')
    .setPlaceholder('Szukaj akcji...')
  );

  // ─── Inicjalizacja ────────────────────────────────

  ngOnInit(): void {
    this.activeTab.set(this.initialTab());
    this.ensureInit();
  }

  /** Ładuje stan z preferencji usera lub domyślnych. */
  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;

    const config = this.toolbarConfig();
    const prefs = this.preferencesService.getState(
      ErpPreferencesType.ActionToolbar,
      config.menuId
    ) as ErpToolbarUserPrefs | undefined;

    // Enabled map
    const enabled: Record<string, boolean> = {};
    const allGroups = [...config.defaultGroups, ...(config.selectionGroups ?? [])];
    for (const group of allGroups) {
      enabled[`group:${group.id}`] = !prefs?.hiddenGroupIds?.includes(group.id);
      for (const action of group.actions) {
        enabled[`action:${action.id}`] = !prefs?.hiddenActionIds?.includes(action.id);
        this.walkChildren(action, enabled, prefs);
      }
    }
    this.enabledMap.set(enabled);

    // Pinned
    this.pinnedIds.set(prefs?.pinnedActionIds ?? config.pinnedActionIds ?? []);

    // Shortcuts
    const shortcuts: Record<string, string> = {};
    if (prefs?.customShortcuts) {
      Object.assign(shortcuts, prefs.customShortcuts);
    }
    this.shortcutMap.set(shortcuts);

    // Dynamic groups
    const dynHidden: Record<string, boolean> = {};
    const dynSubHidden: Record<string, Record<string, boolean>> = {};
    for (const dp of config.dynamicProviders ?? []) {
      const gp = prefs?.dynamicGroupPrefs?.[dp.groupId];
      dynHidden[dp.groupId] = gp?.hidden ?? false;
      dynSubHidden[dp.groupId] = {};
      for (const t of dp.actionTemplate) {
        dynSubHidden[dp.groupId][t.id] = gp?.hiddenSubActionIds?.includes(t.id) ?? false;
      }
    }
    this.dynamicGroupHidden.set(dynHidden);
    this.dynamicSubHidden.set(dynSubHidden);
  }

  private walkChildren(
    action: ErpActionDef,
    enabled: Record<string, boolean>,
    prefs?: ErpToolbarUserPrefs
  ): void {
    if (!action.children) return;
    for (const child of action.children) {
      enabled[`action:${child.id}`] = !prefs?.hiddenActionIds?.includes(child.id);
      this.walkChildren(child, enabled, prefs);
    }
  }

  // ─── Computed ─────────────────────────────────────

  protected readonly _configuratorItems = computed<ConfiguratorItem[]>(() => {
    const config = this.toolbarConfig();
    const enabled = this.enabledMap();
    const pinned = this.pinnedIds();
    const shortcuts = this.shortcutMap();
    const dynHidden = this.dynamicGroupHidden();
    const dynSubHidden = this.dynamicSubHidden();

    const items: ConfiguratorItem[] = [];

    // Statyczne grupy (domyślne oraz wywoływane przy zaznaczeniu)
    const allGroups = [...config.defaultGroups, ...(config.selectionGroups ?? [])];
    for (const group of allGroups) {
      const isSelection = !!config.selectionGroups?.includes(group);
      items.push({
        id: group.id,
        label: this.resolveLabel(group.label),
        icon: unwrapSignal(group.icon) as string | undefined,
        type: group.isDynamic ? 'dynamic-group' : 'group',
        enabled: enabled[`group:${group.id}`] ?? true,
        pinned: false,
        shortcut: '',
        defaultShortcut: '',
        indent: 0,
        isSelectionGroup: isSelection,
      });

      for (const action of group.actions) {
        items.push({
          id: action.id,
          label: this.resolveLabel(action.label),
          icon: unwrapSignal(action.icon) as string | undefined,
          type: 'action',
          groupId: group.id,
          enabled: enabled[`action:${action.id}`] ?? true,
          pinned: pinned.includes(action.id),
          shortcut: shortcuts[action.id] ?? action.shortcut ?? '',
          defaultShortcut: action.shortcut ?? '',
          indent: 1,
          isSelectionGroup: isSelection,
        });
      }
    }

    // Dynamiczne providery
    for (const dp of config.dynamicProviders ?? []) {
      items.push({
        id: dp.groupId,
        label: this.resolveLabel(dp.label),
        icon: unwrapSignal(dp.icon) as string | undefined,
        type: 'dynamic-group',
        enabled: !(dynHidden[dp.groupId] ?? false),
        pinned: false,
        shortcut: '',
        defaultShortcut: '',
        indent: 0,
        isSelectionGroup: false,
      });

      for (const tmpl of dp.actionTemplate) {
        items.push({
          id: tmpl.id,
          label: this.resolveLabel(tmpl.label),
          icon: unwrapSignal(tmpl.icon) as string | undefined,
          type: 'dynamic-sub-action',
          groupId: dp.groupId,
          enabled: !(dynSubHidden[dp.groupId]?.[tmpl.id] ?? false),
          pinned: false,
          shortcut: shortcuts[tmpl.id] ?? tmpl.shortcut ?? '',
          defaultShortcut: tmpl.shortcut ?? '',
          indent: 1,
          isSelectionGroup: false,
        });
      }
    }

    return items;
  });

  protected readonly _filteredConfiguratorItems = computed<ConfiguratorItem[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this._configuratorItems();
    const currentTab = this.activeTab();
    const isSelectionTab = currentTab === 1;

    const tabItems = all.filter(i => !!i.isSelectionGroup === isSelectionTab);
    
    if (!term) return tabItems;

    const result: ConfiguratorItem[] = [];
    let currentGroup: ConfiguratorItem | null = null;
    let groupAdded = false;

    for (const item of tabItems) {
      if (item.type === 'group' || item.type === 'dynamic-group') {
        currentGroup = item;
        groupAdded = false;
        if (item.label.toLowerCase().includes(term)) {
          result.push(item);
          groupAdded = true;
        }
      } else {
        if (item.label.toLowerCase().includes(term)) {
          if (currentGroup && !groupAdded) {
            result.push(currentGroup);
            groupAdded = true;
          }
          result.push(item);
        }
      }
    }
    return result;
  });

  protected readonly _pinnedItems = computed<ConfiguratorItem[]>(() => {
    const ids = this.pinnedIds();
    const all = this._configuratorItems();
    const currentTab = this.activeTab();
    const isSelectionTab = currentTab === 1;

    return ids
      .map(id => all.find(i => i.id === id && i.type === 'action'))
      .filter((i): i is ConfiguratorItem => i !== undefined && !!i.isSelectionGroup === isSelectionTab);
  });

  // ─── Konfiguracja przycisków ──────────────────────

  protected readonly _resetButtonConfig: ErpButtonConfig = {
    label: 'Resetuj',
    iconStart: '@tui.rotate-ccw',
    appearance: 'flat',
    size: 'm',
    fn: () => this.resetToDefaults(),
  };

  protected readonly _cancelButtonConfig: ErpButtonConfig = {
    label: 'Anuluj',
    appearance: 'outline',
    size: 'm',
    fn: () => this.onClose(),
  };

  protected readonly _saveButtonConfig: ErpButtonConfig = {
    label: 'Zapisz',
    appearance: 'primary',
    size: 'm',
    fn: () => this.onSave(),
  };

  // ─── Metody ──────────────────────────────────────

  private resolveLabel(label: MaybeSignal<any>): string {
    const raw = unwrapSignal(label);
    if (typeof raw === 'string') return raw;
    return raw?.key ?? '';
  }

  protected toggleItemEnabled(item: ConfiguratorItem): void {
    const key = item.type === 'group' || item.type === 'dynamic-group'
      ? `group:${item.id}`
      : `action:${item.id}`;

    if (item.type === 'dynamic-group') {
      this.dynamicGroupHidden.update(m => ({ ...m, [item.id]: item.enabled }));
    } else if (item.type === 'dynamic-sub-action' && item.groupId) {
      this.dynamicSubHidden.update(m => ({
        ...m,
        [item.groupId!]: {
          ...(m[item.groupId!] ?? {}),
          [item.id]: item.enabled,
        },
      }));
    } else {
      this.enabledMap.update(m => ({ ...m, [key]: !item.enabled }));
    }

    // Jeżeli odepniemy z widoczności, to też odepnij z pinned
    if (item.enabled && item.pinned) {
      this.pinnedIds.update(ids => ids.filter(id => id !== item.id));
    }
  }

  protected togglePinned(item: ConfiguratorItem): void {
    if (item.pinned) {
      this.pinnedIds.update(ids => ids.filter(id => id !== item.id));
    } else {
      this.pinnedIds.update(ids => [...ids, item.id]);
    }
  }

  protected dropPinned(event: CdkDragDrop<ConfiguratorItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    
    const visibleItems = this._pinnedItems();
    const draggedItemId = visibleItems[event.previousIndex].id;
    const targetItemId = visibleItems[event.currentIndex].id;

    this.pinnedIds.update(ids => {
      const next = [...ids];
      const prevIdx = next.indexOf(draggedItemId);
      const currIdx = next.indexOf(targetItemId);
      if (prevIdx !== -1 && currIdx !== -1) {
        next.splice(prevIdx, 1);
        const insertIdx = next.indexOf(targetItemId);
        if (event.previousIndex < event.currentIndex) {
          next.splice(insertIdx + 1, 0, draggedItemId);
        } else {
          next.splice(insertIdx, 0, draggedItemId);
        }
      }
      return next;
    });
  }

  protected removePinned(itemId: string): void {
    this.pinnedIds.update(ids => ids.filter(id => id !== itemId));
  }

  protected captureShortcut(event: KeyboardEvent, item: ConfiguratorItem): void {
    event.preventDefault();
    event.stopPropagation();

    const key = event.key.toLowerCase();
    if (['control', 'alt', 'shift', 'meta', 'tab', 'escape'].includes(key)) {
      if (key === 'escape') {
        (event.target as HTMLElement).blur();
      }
      return;
    }

    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);

    const combo = parts.join('+');
    this.shortcutMap.update(m => ({ ...m, [item.id]: combo }));
  }

  protected onShortcutBlur(_item: ConfiguratorItem): void {
    // noop — shortcut jest zapisywany w captureShortcut
  }

  protected resetShortcut(item: ConfiguratorItem): void {
    this.shortcutMap.update(m => {
      const next = { ...m };
      delete next[item.id];
      return next;
    });
  }

  protected resetToDefaults(): void {
    this.initialized = false;

    const config = this.toolbarConfig();
    // Czyścimy preferencje
    this.preferencesService.saveState(
      ErpPreferencesType.ActionToolbar,
      config.menuId,
      undefined as any
    );

    this.ensureInit();
  }

  protected onClose(): void {
    this.closed.emit();
  }

  protected onSave(): void {
    const enabled = this.enabledMap();
    const pinned = this.pinnedIds();
    const shortcuts = this.shortcutMap();
    const dynHidden = this.dynamicGroupHidden();
    const dynSubHidden = this.dynamicSubHidden();

    const hiddenActionIds = Object.entries(enabled)
      .filter(([key, val]) => key.startsWith('action:') && !val)
      .map(([key]) => key.replace('action:', ''));

    const hiddenGroupIds = Object.entries(enabled)
      .filter(([key, val]) => key.startsWith('group:') && !val)
      .map(([key]) => key.replace('group:', ''));

    const dynamicGroupPrefs: Record<string, ErpDynamicGroupPrefs> = {};
    for (const [groupId, hidden] of Object.entries(dynHidden)) {
      const subActions = dynSubHidden[groupId] ?? {};
      const hiddenSubActionIds = Object.entries(subActions)
        .filter(([_, h]) => h)
        .map(([id]) => id);

      dynamicGroupPrefs[groupId] = { hidden, hiddenSubActionIds };
    }

    // Filtruj shortcuts — zapisz tylko te, które różnią się od domyślnych
    const customShortcuts: Record<string, string> = {};
    for (const [id, shortcut] of Object.entries(shortcuts)) {
      if (shortcut) {
        customShortcuts[id] = shortcut;
      }
    }

    const prefs: ErpToolbarUserPrefs = {
      hiddenActionIds,
      pinnedActionIds: pinned,
      hiddenGroupIds,
      dynamicGroupPrefs,
      customShortcuts,
    };

    const menuId = this.toolbarConfig().menuId;
    this.preferencesService.saveState(ErpPreferencesType.ActionToolbar, menuId, prefs);

    this.saved.emit(prefs);
    this.closed.emit();
  }
}
