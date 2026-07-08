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
import { TuiIcon, TuiDropdown, TuiDataList } from '@taiga-ui/core';
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
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tabList = _visibleTabs();
    @let sizeVal = _size();

    <div class="erp-tabs">
      <tui-tabs
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
                  @for (segment of path; track segment; let last = $last) {
                    @if ($first) { ( }
                    {{ (segment | erpTranslate) || '' }}
                    @if (!last) { &nbsp;&gt;&nbsp; }
                    @if (last) { ) }
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

      <div class="erp-tabs__content">
        @if (activeTab(); as tab) {
          @if (tab.component) {
            <ng-container *ngComponentOutlet="tab.component; inputs: tab.inputs" />
          }
        }
      </div>
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

    .erp-tabs__content {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
  `],
})
export class ErpTabsComponent {
  readonly config = input.required<ErpTabsConfig>();

  /** Indeks aktywnej zakładki w tui-tabs (0-based). */
  protected readonly activeIndex = signal(0);

  /** Identyfikator aktualnie aktywnej zakładki (top-level lub pod-zakładki). */
  protected readonly activeTabId = signal<string | null>(null);

  /** Lista widocznych (niezamkniętych) zakładek. */
  private readonly closedTabIds = signal<Set<string>>(new Set());

  protected readonly _visibleTabs = computed(() => {
    const tabs = this.config().tabs ?? [];
    const closed = this.closedTabIds();
    return this.filterClosedTabs(tabs, closed);
  });

  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'l');
  protected readonly _underline = computed(() => unwrapSignal(this.config().underline) ?? true);

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
    // Efekt synchronizujący initialValue → activeTabId / activeIndex po zmianie konfiguracji.
    effect(() => {
      const config = this.config();
      const tabs = this._visibleTabs();
      if (tabs.length === 0) return;

      const initialId = config.initialValue || tabs[0].id;
      let foundParentIdx = -1;
      let foundTab: ErpTabItem | null = null;

      for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        if (t.id === initialId) {
          foundParentIdx = i;
          foundTab = t;
          break;
        }
        if (t.children) {
          const child = this.findTabById(t.children, initialId);
          if (child) {
            foundParentIdx = i;
            foundTab = child;
            break;
          }
        }
      }

      if (foundParentIdx >= 0) {
        this.activeIndex.set(foundParentIdx);
        if (foundTab) {
          if (foundTab.children && foundTab.children.length > 0) {
            this.activeTabId.set(this.getFirstLeafTab(foundTab).id);
          } else {
            this.activeTabId.set(foundTab.id);
          }
        }
      }
    }, { allowSignalWrites: true });

    // Efekt reagujący na zmianę aktywnej zakładki → wywołanie callbacku.
    effect(() => {
      const tab = this.activeTab();
      const fn = this.config().onTabChange;
      if (tab && fn) {
        fn(tab.id);
      }
    });
  }

  protected selectTab(tabId: string): void {
    this.activeTabId.set(tabId);
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
    const parentIdx = this._visibleTabs().findIndex((t) => t.id === parent.id);
    if (parentIdx >= 0) {
      this.activeIndex.set(parentIdx);
    }
    this.activeTabId.set(child.id);
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
          this.activeTabId.set(firstLeaf.id);
        } else {
          this.activeTabId.set(null);
        }
      } else {
        this.activeTabId.set(null);
      }
    }
  }
}
