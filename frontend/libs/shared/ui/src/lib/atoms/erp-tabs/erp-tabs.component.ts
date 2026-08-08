import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiTabs, TuiChevron, TuiDataListDropdownManager } from '@taiga-ui/kit';
import { TuiIcon, TuiDropdown, TuiDataList, TuiLoader, TuiHint } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpTabItem, ErpTabsConfig } from './erp-tabs.types';

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [
    CommonModule,
    TuiTabs,
    TuiChevron,
    TuiDropdown,
    TuiDataList,
    TuiDataListDropdownManager,
    TuiIcon,
    TuiLoader,
    TuiHint,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tabList = _visibleTabs();
    @let sizeVal = _size();
    @let layoutVal = _layout();

    <div class="erp-tabs" [class.erp-tabs--vertical]="layoutVal === 'vertical'">
      @if (renderMode() !== 'content') {
        @if (layoutVal === 'horizontal') {
          <tui-tabs
            class="px-2"
            [(activeItemIndex)]="activeIndex"
            [size]="sizeVal"
            [underline]="_underline()"
          >
            @for (tab of tabList; track tab.id) {
          @if (!tab.children || tab.children.length === 0) {
            <button
              tuiTab
              type="button"
              [disabled]="tab.disabled ?? false"
              class="erp-tabs__tab"
              (click)="selectTab(tab.id)"
            >
              @if (tab.icon) {
                <tui-icon
                  [icon]="tab.icon"
                  class="erp-tabs__tab-icon"
                />
              }
              <span class="erp-tabs__tab-label">
                {{ (tab.label | erpTranslate) || '' }}
              </span>
              @if (tab.closable) {
                <span
                  class="erp-tabs__tab-close"
                  (click)="handleClose($event, tab.id)"
                >
                  <tui-icon icon="@tui.x" class="erp-tabs__close-icon" />
                </span>
              }
            </button>
          } @else {
            <button
              tuiTab
              tuiChevron
              tuiDropdownAuto
              type="button"
              [disabled]="tab.disabled ?? false"
              [tuiDropdown]="dropdown"
              (tui-tab-activate)="handleParentTabActivate($event, tab)"
              class="erp-tabs__tab"
            >
              @if (tab.icon) {
                <tui-icon
                  [icon]="tab.icon"
                  class="erp-tabs__tab-icon"
                />
              }
              <span class="erp-tabs__tab-label">
                {{ (tab.label | erpTranslate) || '' }}
                @if (getActiveChildPath(tab); as path) {
                  @for (segment of path; track segment) {
                    <tui-icon icon="@tui.chevron-right" class="erp-tabs__breadcrumb-icon" />
                    {{ (segment | erpTranslate) || '' }}
                  }
                }
              </span>
              @if (tab.closable) {
                <span
                  class="erp-tabs__tab-close"
                  (click)="handleClose($event, tab.id)"
                >
                  <tui-icon icon="@tui.x" class="erp-tabs__close-icon" />
                </span>
              }
              
              <ng-template #dropdown let-close>
                <tui-data-list tuiDataListDropdownManager>
                  @for (child of tab.children; track child.id) {
                    @if (child.children && child.children.length > 0) {
                      <button
                        tuiOption
                        type="button"
                        iconEnd="@tui.chevron-right"
                        tuiDropdownAlign="end"
                        tuiDropdownLimitWidth="auto"
                        tuiDropdownManual
                        tuiDropdownSided
                        [tuiDropdown]="options"
                        [disabled]="child.disabled ?? false"
                      >
                        @if (child.icon) {
                          <tui-icon [icon]="child.icon" style="margin-inline-end: 0.5rem;" />
                        }
                        <span style="flex-grow: 1; text-align: left;">
                          {{ (child.label | erpTranslate) || '' }}
                        </span>
                        @if (activeTabId() === child.id) {
                          <tui-icon icon="@tui.check" style="margin-inline-end: 0.5rem; color: var(--tui-text-action);" />
                        }

                        <ng-template #options>
                          <tui-data-list>
                            @for (subChild of child.children; track subChild.id) {
                              <button
                                tuiOption
                                type="button"
                                [disabled]="subChild.disabled ?? false"
                                (click)="selectChildTab(tab, subChild); close()"
                              >
                                @if (subChild.icon) {
                                  <tui-icon [icon]="subChild.icon" style="margin-inline-end: 0.5rem;" />
                                }
                                <span style="flex-grow: 1;">
                                  {{ (subChild.label | erpTranslate) || '' }}
                                </span>
                                @if (activeTabId() === subChild.id) {
                                  <tui-icon icon="@tui.check" style="margin-inline-start: 0.5rem; margin-inline-end: 0.5rem; color: var(--tui-text-action);" />
                                }
                                @if (subChild.closable) {
                                  <span
                                    role="button"
                                    tabindex="0"
                                    class="erp-tabs__tab-close"
                                    (click)="handleClose($event, subChild.id)"
                                    (keydown.enter)="handleClose($event, subChild.id); $event.preventDefault(); $event.stopPropagation()"
                                    style="margin-inline-start: 0.5rem;"
                                  >
                                    <tui-icon icon="@tui.x" class="erp-tabs__close-icon" />
                                  </span>
                                }
                              </button>
                            }
                          </tui-data-list>
                        </ng-template>
                      </button>
                    } @else {
                      <button
                        tuiOption
                        type="button"
                        [disabled]="child.disabled ?? false"
                        (click)="selectChildTab(tab, child); close()"
                      >
                        @if (child.icon) {
                          <tui-icon [icon]="child.icon" style="margin-inline-end: 0.5rem;" />
                        }
                        <span style="flex-grow: 1;">
                          {{ (child.label | erpTranslate) || '' }}
                        </span>
                        @if (activeTabId() === child.id) {
                          <tui-icon icon="@tui.check" style="margin-inline-start: 0.5rem; margin-inline-end: 0.5rem; color: var(--tui-text-action);" />
                        }
                        @if (child.closable) {
                          <span
                            role="button"
                            tabindex="0"
                            class="erp-tabs__tab-close"
                            (click)="handleClose($event, child.id)"
                            (keydown.enter)="handleClose($event, child.id); $event.preventDefault(); $event.stopPropagation()"
                            style="margin-inline-start: 0.5rem;"
                          >
                            <tui-icon icon="@tui.x" class="erp-tabs__close-icon" />
                          </span>
                        }
                      </button>
                    }
                  }
                </tui-data-list>
              </ng-template>
            </button>
          }
        }
      </tui-tabs>
      } @else {
        <div class="erp-tabs__activity-bar">
          @for (tab of tabList; track tab.id) {
            <ng-template #hintTemplate>
              {{ (tab.label | erpTranslate) || '' }}
              @if (getActiveChildPath(tab); as path) {
                @for (segment of path; track segment) {
                  <tui-icon icon="@tui.chevron-right" class="erp-tabs__breadcrumb-icon" />
                  {{ (segment | erpTranslate) || '' }}
                }
              }
            </ng-template>

            @if (!tab.children || tab.children.length === 0) {
              <button
                type="button"
                class="erp-tabs__activity-btn"
                [class.erp-tabs__activity-btn--active]="activeTabId() === tab.id"
                [disabled]="tab.disabled ?? false"
                (click)="selectTab(tab.id)"
                [tuiHint]="hintTemplate"
              >
                @if (tab.icon) {
                  <tui-icon [icon]="tab.icon" class="erp-tabs__activity-icon" />
                }
              </button>
            } @else {
              <button
                type="button"
                class="erp-tabs__activity-btn"
                [class.erp-tabs__activity-btn--active]="isTabOrChildActive(tab)"
                [class.erp-tabs__activity-btn--expanded]="expandedTabId() === tab.id"
                [disabled]="tab.disabled ?? false"
                (click)="toggleExpanded(tab.id)"
                [tuiHint]="hintTemplate"
              >
                @if (tab.icon) {
                  <tui-icon [icon]="tab.icon" class="erp-tabs__activity-icon" />
                }
              </button>

              @if (expandedTabId() === tab.id) {
                <div class="erp-tabs__activity-children">
                  @for (child of tab.children; track child.id) {
                    <!-- Obsługa 1 poziomu zagłębień w pasku aktywności -->
                    <button
                      type="button"
                      class="erp-tabs__activity-btn erp-tabs__activity-btn--child"
                      [class.erp-tabs__activity-btn--active]="activeTabId() === child.id"
                      [disabled]="child.disabled ?? false"
                      (click)="selectChildTab(tab, child)"
                      [tuiHint]="(child.label | erpTranslate) || ''"
                    >
                      @if (child.icon) {
                        <tui-icon [icon]="child.icon" class="erp-tabs__activity-icon-child" />
                      }
                    </button>
                  }
                </div>
              }
            }
          }
        </div>
      }
      }

      @if (renderMode() !== 'tabs') {
        <div class="erp-tabs__content">
        @if (activeTab(); as tab) {
          @if (tab.component) {
            @defer (on timer(30ms)) {
              <ng-container *ngComponentOutlet="tab.component; inputs: tab.inputs" />
            } @placeholder {
              <div class="erp-defer-loader-container">
                <tui-loader size="l" />
              </div>
            }
          }
        }
      </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .erp-tabs {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .erp-tabs--vertical {
      flex-direction: row;
    }

    .erp-tabs__activity-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 48px;
      min-width: 48px;
      background: var(--tui-background-elevation-1);
      border-right: 1px solid var(--tui-border-normal);
      padding-top: 0.5rem;
      gap: 0.5rem;
      z-index: 10;
    }

    .erp-tabs__activity-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border: none;
      background: transparent;
      color: var(--tui-text-tertiary);
      cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease;
      outline: none;
    }

    .erp-tabs__activity-btn:hover:not(:disabled) {
      color: var(--tui-text-primary);
    }

    .erp-tabs__activity-btn:active:not(:disabled) {
      color: var(--tui-text-primary);
      background: var(--tui-background-neutral-1-pressed);
    }

    .erp-tabs__activity-btn--active {
      color: var(--tui-text-action);
    }

    .erp-tabs__activity-btn--active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10%;
      bottom: 10%;
      width: 3px;
      background-color: var(--tui-background-accent-1, var(--tui-text-action));
      border-radius: 0 4px 4px 0;
    }

    .erp-tabs__activity-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .erp-tabs__activity-children {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      padding: 0.25rem 0;
      gap: 0.25rem;
    }

    .erp-tabs__activity-btn--child {
      width: 40px;
      height: 40px;
    }

    .erp-tabs__activity-icon-child {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }

    .erp-tabs__tab {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
    }

    .erp-tabs__tab-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }

    .erp-tabs__tab-label {
      white-space: nowrap;
    }

    .erp-tabs__tab-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-inline-start: 0.25rem;
      padding: 0.125rem;
      border: none;
      background: transparent;
      border-radius: var(--tui-radius-xs);
      color: var(--tui-text-tertiary);
      cursor: pointer;
      transition: color var(--tui-duration) ease, background var(--tui-duration) ease;
      line-height: 0;
    }

    .erp-tabs__tab-close:hover {
      color: var(--tui-text-primary);
      background: var(--tui-background-neutral-1-hover);
    }

    .erp-tabs__tab-close:active {
      color: var(--tui-text-primary);
      background: var(--tui-background-neutral-1-pressed);
    }

    .erp-tabs__close-icon {
      font-size: 0.75rem;
      width: 0.75rem;
      height: 0.75rem;
    }

    .erp-tabs__breadcrumb-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
      margin: 0 0.125rem;
      vertical-align: text-bottom;
      color: var(--tui-text-tertiary);
    }

    .erp-tabs__content {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }

    .erp-defer-loader-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }
  `],
})
export class ErpTabsComponent {
  readonly config = input.required<ErpTabsConfig>();
  public readonly renderMode = input<'full' | 'tabs' | 'content'>('full');

  protected readonly internalActiveTabId = signal<string | null>(null);
  protected readonly configState = computed(() => this.config().state);
  
  protected readonly activeTabId = computed(() => {
    const state = this.configState();
    return state ? state() : this.internalActiveTabId();
  });
  
  protected readonly activeIndex = signal<number>(0);
  protected readonly expandedTabId = signal<string | null>(null);

  /** Lista widocznych (niezamkniętych) zakładek. */
  private readonly closedTabIds = signal<Set<string>>(new Set());

  protected readonly _visibleTabs = computed(() => {
    const tabs = this.config().tabs ?? [];
    const closed = this.closedTabIds();
    return this.filterClosedTabs(tabs, closed);
  });

  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'l');
  protected readonly _underline = computed(() => unwrapSignal(this.config().underline) ?? true);
  protected readonly _layout = computed(() => unwrapSignal(this.config().layout) ?? 'horizontal');

  /** Aktualnie aktywna zakładka (obiekt). */
  protected readonly activeTab = computed(() => {
    const tabs = this._visibleTabs();
    const activeId = this.activeTabId();
    
    if (activeId) {
      const found = this.findTabById(tabs, activeId);
      if (found) {
        return found;
      }
    }
    
    // Fallback
    const firstTab = tabs[0];
    if (firstTab?.children && firstTab.children.length > 0) {
      return this.getFirstLeafTab(firstTab);
    }
    return firstTab;
  });

  constructor() {
    effect(() => {
      const tabs = this._visibleTabs();
      const initial = unwrapSignal(this.config().initialValue);
      
      const state = this.configState();
      if (!state?.() && !this.internalActiveTabId()) {
        if (initial) {
          if (state) state.set(initial);
          else this.internalActiveTabId.set(initial);
        } else if (tabs.length > 0) {
          if (state) state.set(tabs[0].id);
          else this.internalActiveTabId.set(tabs[0].id);
        }
      }
      
      const active = this.activeTabId();
      if (active) {
        const idx = tabs.findIndex((t) => t.id === active);
        if (idx !== -1 && idx !== this.activeIndex()) {
          this.activeIndex.set(idx);
        }
      }
    });

    effect(() => {
      const tab = this.activeTab();
      const fn = this.config().onTabChange;
      if (tab && fn) {
        fn(tab.id);
      }
    });
  }

  protected toggleExpanded(tabId: string): void {
    this.expandedTabId.update(v => v === tabId ? null : tabId);
  }

  protected selectTab(tabId: string): void {
    const state = this.configState();
    if (state) {
      state.set(tabId);
    } else {
      this.internalActiveTabId.set(tabId);
    }
    
    const onChange = this.config().onTabChange;
    if (onChange) onChange(tabId);
  }

  protected getActiveChildPath(tab: ErpTabItem): any[] | null {
    const activeId = this.activeTabId();
    if (!activeId) return null;
    if (tab.id === activeId) return null;

    const path: any[] = [];
    const found = this.buildPathToTab(tab.children || [], activeId, path);
    return found ? path : null;
  }

  protected handleParentTabActivate(event: Event, tab: ErpTabItem): void {
    event.stopPropagation();
  }

  protected selectChildTab(parent: ErpTabItem, child: ErpTabItem): void {
    if (this.activeTabId() === child.id) return;
    const parentIdx = this._visibleTabs().findIndex((t) => t.id === parent.id);
    if (parentIdx >= 0) {
      this.activeIndex.set(parentIdx);
    }
    this.selectTab(child.id);
  }

  protected isTabOrChildActive(tab: ErpTabItem): boolean {
    const activeId = this.activeTabId();
    if (!activeId) return false;
    if (tab.id === activeId) return true;
    return !!this.findTabById(tab.children || [], activeId);
  }

  private filterClosedTabs(tabs: ErpTabItem[], closed: Set<string>): ErpTabItem[] {
    return tabs
      .filter((t) => !closed.has(t.id))
      .map((t) => {
        if (t.children && t.children.length > 0) {
          return {
            ...t,
            children: this.filterClosedTabs(t.children, closed),
          };
        }
        return t;
      });
  }

  private buildPathToTab(tabs: ErpTabItem[], id: string, path: any[]): boolean {
    for (const t of tabs) {
      path.push(t.label);
      if (t.id === id) {
        return true;
      }
      if (t.children) {
        const found = this.buildPathToTab(t.children, id, path);
        if (found) {
          return true;
        }
      }
      path.pop();
    }
    return false;
  }

  private findTabById(tabs: ErpTabItem[], id: string): ErpTabItem | null {
    for (const t of tabs) {
      if (t.id === id) {
        return t;
      }
      if (t.children) {
        const found = this.findTabById(t.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  private getFirstLeafTab(tab: ErpTabItem): ErpTabItem {
    if (tab.children && tab.children.length > 0) {
      return this.getFirstLeafTab(tab.children[0]);
    }
    return tab;
  }

  /**
   * Obsługa zamykania zakładki.
   * Zatrzymuje propagację zdarzenia aby nie aktywować zakładki.
   */
  protected async handleClose(event: Event, tabId: string): Promise<void> {
    event.stopPropagation();
    event.preventDefault();

    const onTabClose = this.config().onTabClose;
    if (onTabClose) {
      const result = onTabClose(tabId);
      if (result instanceof Promise) {
        await result;
      }
    }

    // Dodaj do zamkniętych
    this.closedTabIds.update((set) => {
      const next = new Set(set);
      next.add(tabId);
      return next;
    });

    // Jeśli zamknięto aktualnie aktywną zakładkę (lub jej rodzica), wybierz nową aktywną
    const activeId = this.activeTabId();
    const closedTab = this.findTabById(this.config().tabs ?? [], tabId);
    const isActiveOrChildActive = activeId === tabId || (!!closedTab && !!activeId && !!this.findTabById(closedTab.children || [], activeId));

    if (isActiveOrChildActive) {
      const visibleTabs = this._visibleTabs();
      if (visibleTabs.length > 0) {
        const firstLeaf = this.getFirstLeafTab(visibleTabs[0]);
        if (firstLeaf) {
          const parentIdx = visibleTabs.findIndex((t) => t.id === visibleTabs[0].id || this.findTabById([t], firstLeaf.id));
          this.activeIndex.set(parentIdx >= 0 ? parentIdx : 0);
          this.selectTab(firstLeaf.id);
        } else {
          // Jeśli brakuje zakładek, wywołujemy selectTab('') lub zostawiamy puste
          this.selectTab('');
        }
      } else {
        this.selectTab('');
      }
    }
  }
}
