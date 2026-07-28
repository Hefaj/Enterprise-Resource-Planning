import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButton, TuiIcon, TuiHint } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpPageLayoutConfig } from './erp-page-layout.types';

@Component({
  selector: 'erp-page-layout',
  standalone: true,
  imports: [CommonModule, TuiButton, TuiIcon, TuiHint, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let sidebar = _leftSidebar();
    @let main = _main();
    @let collapsed = _collapsed();
    @let width = _sidebarWidth();
    @let mode = _sidebarMode();

    <div
      class="erp-page-layout"
      [class.erp-page-layout--collapsed]="collapsed"
      [class.erp-page-layout--overlay]="mode === 'overlay'"
      [class.erp-page-layout--has-sidebar]="!!sidebar"
    >
      @if (mode === 'overlay' && !collapsed) {
        <div class="erp-page-layout__backdrop" (click)="toggleSidebar()"></div>
      }

      @if (sidebar) {
        <aside
          class="erp-page-layout__sidebar"
          [style.width.px]="collapsed ? 48 : width"
          [style.min-width.px]="collapsed ? 48 : width"
        >
          <div class="erp-page-layout__sidebar-header">
            <button
              tuiIconButton
              appearance="flat"
              size="s"
              (click)="toggleSidebar()"
              [tuiHint]="(collapsed ? SHARED_KEYS.sidebar.expand : SHARED_KEYS.sidebar.collapse) | erpTranslate"
            >
              <tui-icon [icon]="collapsed ? '@tui.list-filter' : '@tui.chevron-left'" />
            </button>
            @if (!collapsed) {
              <button
                tuiIconButton
                appearance="flat"
                size="s"
                (click)="toggleSidebarMode()"
                [tuiHint]="(mode === 'push' ? SHARED_KEYS.sidebar.unpin : SHARED_KEYS.sidebar.pin) | erpTranslate"
              >
                <tui-icon [icon]="mode === 'push' ? '@tui.pin' : '@tui.pin-off'" />
              </button>
            }
          </div>
          <div class="erp-page-layout__sidebar-content" [class.erp-page-layout__sidebar-content--hidden]="collapsed">
            <ng-container *ngComponentOutlet="sidebar.component; inputs: sidebar.inputs" />
          </div>
        </aside>
      }

      <main class="erp-page-layout__main">
        @if (main) {
          <ng-container *ngComponentOutlet="main.component; inputs: main.inputs" />
        }
      </main>
    </div>
  `,
  styles: [`
    :host {
      flex-grow: 1;
      display: block;
      height: 100%;
      width: 100%;
    }

    .erp-page-layout {
      display: flex;
      height: 100%;
      width: 100%;
      position: relative;
      overflow: hidden;
    }

    .erp-page-layout__backdrop {
      position: absolute;
      inset: 0;
      z-index: 90;
      background: transparent;
    }

    .erp-page-layout__sidebar {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                  min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 0.25s ease;
      flex-shrink: 0;
      border-inline-end: 1px solid var(--tui-border-normal);
      background: var(--tui-background-elevation-1);
      z-index: 100;
    }

    .erp-page-layout--overlay .erp-page-layout__sidebar {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
    }
    
    .erp-page-layout--overlay:not(.erp-page-layout--collapsed) .erp-page-layout__sidebar {
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
    }

    .erp-page-layout__sidebar-header {
      display: flex;
      align-items: center;
      height: 48px;
      flex-shrink: 0;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s ease, justify-content 0.2s ease;
      justify-content: center;
    }

    .erp-page-layout:not(.erp-page-layout--collapsed) .erp-page-layout__sidebar-header {
      border-bottom-color: var(--tui-border-normal);
      justify-content: space-between;
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }

    .erp-page-layout__sidebar-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      opacity: 1;
      transition: opacity 0.2s ease;
    }

    .erp-page-layout__sidebar-content--hidden {
      opacity: 0;
      pointer-events: none;
    }

    .erp-page-layout__main {
      flex: 1;
      padding: 0 1rem;
      height: 100%;
      overflow: auto;
      min-width: 0;
    }

    .erp-page-layout--overlay.erp-page-layout--has-sidebar .erp-page-layout__main {
      margin-left: 48px;
    }
  `],
})
export class ErpPageLayoutComponent {
  readonly config = input.required<ErpPageLayoutConfig>();
  protected readonly SHARED_KEYS = SHARED_KEYS;

  /** Wewnętrzny stan zwinięcia sidebara — używany gdy nie przekazano sidebarCollapsed z zewnątrz. */
  private readonly _internalCollapsed = signal(true);
  /** Wewnętrzny tryb działania sidebara (nadpisuje zewnętrzną konfigurację jeśli został kliknięty). */
  private readonly _internalMode = signal<'push' | 'overlay' | null>(null);

  protected readonly _leftSidebar = computed(() => this.config().leftSidebar);
  protected readonly _main = computed(() => this.config().main);
  protected readonly _sidebarWidth = computed(() => unwrapSignal(this.config().sidebarWidth) ?? 280);
  
  protected readonly _sidebarMode = computed(() => {
    const internal = this._internalMode();
    if (internal) return internal;
    return unwrapSignal(this.config().sidebarMode) ?? 'push';
  });

  protected readonly _collapsed = computed(() => {
    const external = unwrapSignal(this.config().sidebarCollapsed);
    return external ?? this._internalCollapsed();
  });

  protected toggleSidebar(): void {
    this._internalCollapsed.update((v) => !v);
  }

  protected toggleSidebarMode(): void {
    const currentMode = this._sidebarMode();
    this._internalMode.set(currentMode === 'push' ? 'overlay' : 'push');
  }
}
