import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  inject,
  HostListener,
  effect,
  untracked,
  viewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButton, TuiIcon, TuiHint, TuiLoader } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpPageLayoutConfig } from './erp-page-layout.types';
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';

@Component({
  selector: 'erp-page-layout',
  standalone: true,
  imports: [CommonModule, TuiButton, TuiIcon, TuiHint, TuiLoader, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let leftSidebar = _leftSidebar();
    @let rightSidebar = _rightSidebar();
    @let main = _main();
    
    @let leftCollapsed = _leftCollapsed();
    @let leftMode = _leftMode();
    @let leftResizable = _leftResizable();
    
    @let rightCollapsed = _rightCollapsed();
    @let rightMode = _rightMode();
    @let rightResizable = _rightResizable();

    <div
      class="erp-page-layout"
      [class.erp-page-layout--dragging]="!!_dragState()"
      [class.erp-page-layout--left-collapsed]="leftCollapsed"
      [class.erp-page-layout--left-overlay]="leftMode === 'overlay'"
      [class.erp-page-layout--right-collapsed]="rightCollapsed"
      [class.erp-page-layout--right-overlay]="rightMode === 'overlay'"
      [class.erp-page-layout--has-left-sidebar]="!!leftSidebar"
      [class.erp-page-layout--has-right-sidebar]="!!rightSidebar"
    >
      @if (leftSidebar) {
        <aside
          #leftSidebarEl
          class="erp-page-layout__sidebar erp-page-layout__sidebar--left"
          [style.width]="leftCollapsed ? '3rem' : _leftWidth() + 'px'"
          [style.min-width]="leftCollapsed ? '3rem' : _leftWidth() + 'px'"
        >
          <div 
            #leftHeaderEl
            class="erp-page-layout__sidebar-header-wrapper"
            [class.erp-page-layout__sidebar-header-wrapper--open]="leftCollapsed || _leftHeaderVisible()"
          >
            @if (!leftCollapsed && !_leftHeaderVisible()) {
              <div 
                class="erp-page-layout__sidebar-header-trigger"
                (click)="_leftHeaderVisible.set(true)"
              >
                <div class="erp-page-layout__sidebar-header-trigger-line"></div>
              </div>
            }
            <div class="erp-page-layout__sidebar-header">
              <button
                class="erp-page-layout__sidebar-btn-left"
                tuiIconButton
                appearance="flat"
                size="s"
                (click)="toggleLeftSidebar()"
                [tuiHint]="(leftCollapsed ? SHARED_KEYS.sidebar.expand : SHARED_KEYS.sidebar.collapse) | erpTranslate"
              >
                <tui-icon [icon]="leftCollapsed ? '@tui.list-filter' : '@tui.chevron-left'" />
              </button>
              @if (!leftCollapsed) {
                <button
                  class="erp-page-layout__sidebar-btn-right"
                  tuiIconButton
                  appearance="flat"
                  size="s"
                  (click)="toggleLeftSidebarMode()"
                  [tuiHint]="(leftMode === 'push' ? SHARED_KEYS.sidebar.unpin : SHARED_KEYS.sidebar.pin) | erpTranslate"
                >
                  <tui-icon [icon]="leftMode === 'push' ? '@tui.pin-off' : '@tui.pin'" />
                </button>
              }
            </div>
          </div>
          <div class="erp-page-layout__sidebar-content" [class.erp-page-layout__sidebar-content--hidden]="leftCollapsed">
            @defer (on timer(30ms)) {
              <ng-container *ngComponentOutlet="leftSidebar.component; inputs: leftSidebar.inputs" />
            } @placeholder {
              <div class="erp-defer-loader-container">
                <tui-loader size="l" />
              </div>
            }
          </div>
          @if (!leftCollapsed && leftResizable) {
            <div class="erp-page-layout__resizer erp-page-layout__resizer--left" (mousedown)="startDrag($event, 'left')"></div>
          }
        </aside>
      }

      <main class="erp-page-layout__main">
        @if (main) {
          @defer (on timer(30ms)) {
            <ng-container *ngComponentOutlet="main.component; inputs: main.inputs" />
          } @placeholder {
            <div class="erp-defer-loader-container">
              <tui-loader size="l" />
            </div>
          }
        }
      </main>

      @if (rightSidebar) {
        <aside
          #rightSidebarEl
          class="erp-page-layout__sidebar erp-page-layout__sidebar--right"
          [style.width]="rightCollapsed ? '3rem' : _rightWidth() + 'px'"
          [style.min-width]="rightCollapsed ? '3rem' : _rightWidth() + 'px'"
        >
          @if (!rightCollapsed && rightResizable) {
            <div class="erp-page-layout__resizer erp-page-layout__resizer--right" (mousedown)="startDrag($event, 'right')"></div>
          }
          <div 
            #rightHeaderEl
            class="erp-page-layout__sidebar-header-wrapper"
            [class.erp-page-layout__sidebar-header-wrapper--open]="rightCollapsed || _rightHeaderVisible()"
          >
            @if (!rightCollapsed && !_rightHeaderVisible()) {
              <div 
                class="erp-page-layout__sidebar-header-trigger"
                (click)="_rightHeaderVisible.set(true)"
              >
                <div class="erp-page-layout__sidebar-header-trigger-line"></div>
              </div>
            }
            <div class="erp-page-layout__sidebar-header">
              @if (!rightCollapsed) {
                <button
                  class="erp-page-layout__sidebar-btn-left"
                  tuiIconButton
                  appearance="flat"
                  size="s"
                  (click)="toggleRightSidebarMode()"
                  [tuiHint]="(rightMode === 'push' ? SHARED_KEYS.sidebar.unpin : SHARED_KEYS.sidebar.pin) | erpTranslate"
                >
                  <tui-icon [icon]="rightMode === 'push' ? '@tui.pin-off' : '@tui.pin'" />
                </button>
              }
              <button
                class="erp-page-layout__sidebar-btn-right"
                tuiIconButton
                appearance="flat"
                size="s"
                (click)="toggleRightSidebar()"
                [tuiHint]="(rightCollapsed ? SHARED_KEYS.sidebar.expand : SHARED_KEYS.sidebar.collapse) | erpTranslate"
              >
                <tui-icon [icon]="rightCollapsed ? '@tui.list-filter' : '@tui.chevron-right'" />
              </button>
            </div>
          </div>
          <div class="erp-page-layout__sidebar-content" [class.erp-page-layout__sidebar-content--hidden]="rightCollapsed">
            @defer (on timer(30ms)) {
              <ng-container *ngComponentOutlet="rightSidebar.component; inputs: rightSidebar.inputs" />
            } @placeholder {
              <div class="erp-defer-loader-container">
                <tui-loader size="l" />
              </div>
            }
          </div>
        </aside>
      }
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

    .erp-page-layout--dragging {
      user-select: none;
    }

    .erp-page-layout__sidebar {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0s,
                  min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0s,
                  box-shadow 0.25s ease;
      flex-shrink: 0;
      background: var(--tui-background-elevation-1);
      z-index: 100;
      position: relative;
    }

    .erp-page-layout__sidebar--left {
      border-inline-end: 1px solid var(--tui-border-normal);
    }
    
    .erp-page-layout__sidebar--right {
      border-inline-start: 1px solid var(--tui-border-normal);
    }

    .erp-page-layout--left-collapsed .erp-page-layout__sidebar--left,
    .erp-page-layout--right-collapsed .erp-page-layout__sidebar--right {
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.15s,
                  min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.15s,
                  box-shadow 0.25s ease;
    }

    .erp-page-layout--dragging .erp-page-layout__sidebar {
      transition: none; /* Disable transition during drag */
    }

    /* Overlays */
    .erp-page-layout--left-overlay .erp-page-layout__sidebar--left {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
    }
    .erp-page-layout--right-overlay .erp-page-layout__sidebar--right {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
    }
    
    .erp-page-layout--left-overlay:not(.erp-page-layout--left-collapsed) .erp-page-layout__sidebar--left,
    .erp-page-layout--right-overlay:not(.erp-page-layout--right-collapsed) .erp-page-layout__sidebar--right {
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
    }
    .erp-page-layout--right-overlay:not(.erp-page-layout--right-collapsed) .erp-page-layout__sidebar--right {
      box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
    }

    /* Resizers */
    .erp-page-layout__resizer {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 10px;
      cursor: col-resize;
      background-color: transparent;
      z-index: 110;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .erp-page-layout__resizer::after {
      content: '';
      display: block;
      width: 4px;
      height: 24px;
      border-radius: 4px;
      background-color: var(--tui-border-hover, #999);
      opacity: 0.6;
      transition: background-color 0.2s ease, opacity 0.2s ease;
    }
    
    .erp-page-layout__resizer:hover::after,
    .erp-page-layout--dragging .erp-page-layout__resizer::after {
      background-color: var(--tui-background-accent-1, var(--tui-text-action, #0055ff));
      opacity: 1;
    }

    .erp-page-layout__resizer--left {
      right: 0;
    }
    .erp-page-layout__resizer--right {
      left: 0;
    }

    .erp-page-layout__sidebar-header-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
    }

    .erp-page-layout--left-collapsed .erp-page-layout__sidebar--left .erp-page-layout__sidebar-header-wrapper,
    .erp-page-layout--right-collapsed .erp-page-layout__sidebar--right .erp-page-layout__sidebar-header-wrapper {
      position: relative;
    }

    .erp-page-layout__sidebar-header-trigger {
      height: 12px;
      width: 100%;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: transparent;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .erp-page-layout__sidebar-header-trigger:hover {
      opacity: 1;
    }

    .erp-page-layout__sidebar-header-trigger-line {
      width: 40px;
      height: 4px;
      margin-top: 0;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      background-color: var(--tui-border-hover, #999);
      transition: background-color 0.2s ease, width 0.2s ease;
    }
    
    .erp-page-layout__sidebar-header-trigger:hover .erp-page-layout__sidebar-header-trigger-line {
      background-color: var(--tui-background-accent-1, var(--tui-text-action, #0055ff));
      width: 100%;
      border-radius: 0;
    }

    .erp-page-layout__sidebar-header {
      display: flex;
      align-items: center;
      height: 0;
      overflow: hidden;
      background: var(--tui-background-elevation-1);
      padding: 0 0.5rem;
      transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border-bottom: 1px solid transparent;
    }

    .erp-page-layout__sidebar-header-wrapper--open .erp-page-layout__sidebar-header {
      height: 2.2rem;
      border-bottom-color: var(--tui-border-normal);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .erp-page-layout--left-collapsed .erp-page-layout__sidebar--left .erp-page-layout__sidebar-header-wrapper--open .erp-page-layout__sidebar-header,
    .erp-page-layout--right-collapsed .erp-page-layout__sidebar--right .erp-page-layout__sidebar-header-wrapper--open .erp-page-layout__sidebar-header {
      box-shadow: none;
      border-bottom-color: transparent;
      background: transparent;
    }
    
    .erp-page-layout__sidebar-btn-right {
      margin-left: auto;
    }

    .erp-page-layout__sidebar-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      opacity: 1;
      transition: opacity 0.2s ease 0.25s;
    }

    .erp-page-layout__sidebar-content--hidden {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease 0s;
    }

    .erp-page-layout__main {
      flex: 1;
      height: 100%;
      overflow: auto;
      min-width: 0;
    }

    .erp-page-layout--left-overlay.erp-page-layout--has-left-sidebar .erp-page-layout__main {
      margin-left: 3rem;
    }
    .erp-page-layout--right-overlay.erp-page-layout--has-right-sidebar .erp-page-layout__main {
      margin-right: 3rem;
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
export class ErpPageLayoutComponent {
  readonly config = input.required<ErpPageLayoutConfig>();
  protected readonly SHARED_KEYS = SHARED_KEYS;
  
  private readonly prefsService = inject(ErpUserPreferencesService);

  private readonly leftSidebarEl = viewChild<ElementRef<HTMLElement>>('leftSidebarEl');
  private readonly rightSidebarEl = viewChild<ElementRef<HTMLElement>>('rightSidebarEl');
  private readonly leftHeaderEl = viewChild<ElementRef<HTMLElement>>('leftHeaderEl');
  private readonly rightHeaderEl = viewChild<ElementRef<HTMLElement>>('rightHeaderEl');
  private saveTimeout: any;

  protected readonly _leftHeaderVisible = signal(false);
  protected readonly _rightHeaderVisible = signal(false);
  protected readonly _dragState = signal<{ type: 'left' | 'right', startX: number, startWidth: number } | null>(null);

  protected readonly _leftWidth = signal<number>(280);
  protected readonly _rightWidth = signal<number>(280);

  // Left Sidebar Signals
  private readonly _internalLeftCollapsed = signal(true);
  private readonly _internalLeftMode = signal<'push' | 'overlay' | null>(null);
  
  protected readonly _leftSidebar = computed(() => this.config().leftSidebar);
  protected readonly _leftResizable = computed(() => unwrapSignal(this.config().leftSidebarResizable) ?? true);
  protected readonly _leftMinWidth = computed(() => unwrapSignal(this.config().leftSidebarMinWidth) ?? 100);
  protected readonly _leftMaxWidth = computed(() => unwrapSignal(this.config().leftSidebarMaxWidth) ?? 800);
  protected readonly _leftMode = computed(() => {
    const internal = this._internalLeftMode();
    if (internal) return internal;
    return unwrapSignal(this.config().leftSidebarMode) ?? 'push';
  });
  protected readonly _leftCollapsed = computed(() => this._internalLeftCollapsed());

  // Right Sidebar Signals
  private readonly _internalRightCollapsed = signal(true);
  private readonly _internalRightMode = signal<'push' | 'overlay' | null>(null);
  
  protected readonly _rightSidebar = computed(() => this.config().rightSidebar);
  protected readonly _rightResizable = computed(() => unwrapSignal(this.config().rightSidebarResizable) ?? true);
  protected readonly _rightMinWidth = computed(() => unwrapSignal(this.config().rightSidebarMinWidth) ?? 100);
  protected readonly _rightMaxWidth = computed(() => unwrapSignal(this.config().rightSidebarMaxWidth) ?? 800);
  protected readonly _rightMode = computed(() => {
    const internal = this._internalRightMode();
    if (internal) return internal;
    return unwrapSignal(this.config().rightSidebarMode) ?? 'push';
  });
  protected readonly _rightCollapsed = computed(() => this._internalRightCollapsed());

  protected readonly _main = computed(() => this.config().main);

  constructor() {
    effect(() => {
      const cfg = this.config();
      const layoutId = cfg.layoutId;
      const configLeftW = unwrapSignal(cfg.leftSidebarWidth);
      const configRightW = unwrapSignal(cfg.rightSidebarWidth);
      
      const leftMin = unwrapSignal(cfg.leftSidebarMinWidth) ?? 100;
      const leftMax = unwrapSignal(cfg.leftSidebarMaxWidth) ?? 800;
      const rightMin = unwrapSignal(cfg.rightSidebarMinWidth) ?? 100;
      const rightMax = unwrapSignal(cfg.rightSidebarMaxWidth) ?? 800;

      untracked(() => {
        let leftW = configLeftW ?? Math.max(280, leftMin);
        let rightW = configRightW ?? Math.max(280, rightMin);
        
        if (layoutId) {
          const saved = this.prefsService.getState(ErpPreferencesType.PageLayout, layoutId);
          if (saved?.leftWidth !== undefined) leftW = saved.leftWidth;
          if (saved?.rightWidth !== undefined) rightW = saved.rightWidth;
          
          if (saved?.leftCollapsed !== undefined) this._internalLeftCollapsed.set(saved.leftCollapsed);
          if (saved?.leftMode !== undefined) this._internalLeftMode.set(saved.leftMode);
          if (saved?.rightCollapsed !== undefined) this._internalRightCollapsed.set(saved.rightCollapsed);
          if (saved?.rightMode !== undefined) this._internalRightMode.set(saved.rightMode);
        }
        
        this._leftWidth.set(Math.max(leftMin, Math.min(leftMax, leftW)));
        this._rightWidth.set(Math.max(rightMin, Math.min(rightMax, rightW)));
      });
    });

    // Sync external collapsed state with internal state so that it can be overridden
    effect(() => {
      const externalLeft = unwrapSignal(this.config().leftSidebarCollapsed);
      if (externalLeft !== undefined) {
        untracked(() => this._internalLeftCollapsed.set(externalLeft));
      }
    });

    effect(() => {
      const externalRight = unwrapSignal(this.config().rightSidebarCollapsed);
      if (externalRight !== undefined) {
        untracked(() => this._internalRightCollapsed.set(externalRight));
      }
    });
  }

  protected toggleLeftSidebar(): void {
    this._internalLeftCollapsed.update((v) => !v);
    this._leftHeaderVisible.set(false);
    this.saveLayoutState();
  }

  protected toggleLeftSidebarMode(): void {
    const currentMode = this._leftMode();
    this._internalLeftMode.set(currentMode === 'push' ? 'overlay' : 'push');
    this._leftHeaderVisible.set(false);
    this.saveLayoutState();
  }

  protected toggleRightSidebar(): void {
    this._internalRightCollapsed.update((v) => !v);
    this._rightHeaderVisible.set(false);
    this.saveLayoutState();
  }

  protected toggleRightSidebarMode(): void {
    const currentMode = this._rightMode();
    this._internalRightMode.set(currentMode === 'push' ? 'overlay' : 'push');
    this._rightHeaderVisible.set(false);
    this.saveLayoutState();
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocumentMouseDown(event: MouseEvent): void {
    const target = event.target as Node;
    
    if (this._leftMode() === 'overlay' && !this._internalLeftCollapsed()) {
      const leftEl = this.leftSidebarEl()?.nativeElement;
      if (leftEl && !leftEl.contains(target)) {
        this._internalLeftCollapsed.set(true);
      }
    }

    if (this._rightMode() === 'overlay' && !this._internalRightCollapsed()) {
      const rightEl = this.rightSidebarEl()?.nativeElement;
      if (rightEl && !rightEl.contains(target)) {
        this._internalRightCollapsed.set(true);
      }
    }

    if (this._leftHeaderVisible()) {
      const leftHeaderEl = this.leftHeaderEl()?.nativeElement;
      if (leftHeaderEl && !leftHeaderEl.contains(target)) {
        this._leftHeaderVisible.set(false);
      }
    }

    if (this._rightHeaderVisible()) {
      const rightHeaderEl = this.rightHeaderEl()?.nativeElement;
      if (rightHeaderEl && !rightHeaderEl.contains(target)) {
        this._rightHeaderVisible.set(false);
      }
    }
  }

  protected startDrag(event: MouseEvent, type: 'left' | 'right'): void {
    event.preventDefault();
    this._dragState.set({
      type,
      startX: event.clientX,
      startWidth: type === 'left' ? this._leftWidth() : this._rightWidth()
    });
  }

  @HostListener('document:mousemove', ['$event'])
  protected onMouseMove(event: MouseEvent): void {
    const drag = this._dragState();
    if (!drag) return;
    
    if (drag.type === 'left') {
      const delta = event.clientX - drag.startX;
      const minW = this._leftMinWidth();
      const maxW = this._leftMaxWidth();
      const newWidth = Math.max(minW, Math.min(maxW, drag.startWidth + delta));
      this._leftWidth.set(newWidth);
    } else {
      const delta = drag.startX - event.clientX; // drag left increases width
      const minW = this._rightMinWidth();
      const maxW = this._rightMaxWidth();
      const newWidth = Math.max(minW, Math.min(maxW, drag.startWidth + delta));
      this._rightWidth.set(newWidth);
    }
  }

  @HostListener('document:mouseup')
  protected onMouseUp(): void {
    const drag = this._dragState();
    if (drag) {
      this._dragState.set(null);
      this.saveLayoutState();
    }
  }

  private saveLayoutState(): void {
    const layoutId = this.config().layoutId;
    if (layoutId) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.prefsService.saveState(ErpPreferencesType.PageLayout, layoutId, {
          leftWidth: this._leftWidth(),
          rightWidth: this._rightWidth(),
          leftCollapsed: this._leftCollapsed(),
          leftMode: this._leftMode(),
          rightCollapsed: this._rightCollapsed(),
          rightMode: this._rightMode()
        });
      }, 400);
    }
  }
}
