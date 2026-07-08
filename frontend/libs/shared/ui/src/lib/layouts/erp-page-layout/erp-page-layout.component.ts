import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpButtonBuilder, ErpButtonComponent } from '../../atoms/erp-button';
import { ErpPageLayoutConfig } from './erp-page-layout.types';

@Component({
  selector: 'erp-page-layout',
  standalone: true,
  imports: [CommonModule, ErpButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let sidebar = _leftSidebar();
    @let main = _main();
    @let collapsed = _collapsed();
    @let width = _sidebarWidth();

    <div class="erp-page-layout" [class.erp-page-layout--collapsed]="collapsed">
      @if (sidebar) {
        <aside
          class="erp-page-layout__sidebar"
          [style.width.px]="collapsed ? 0 : width"
          [style.min-width.px]="collapsed ? 0 : width"
        >
          <div class="erp-page-layout__sidebar-content" [class.erp-page-layout__sidebar-content--hidden]="collapsed">
            <ng-container *ngComponentOutlet="sidebar.component; inputs: sidebar.inputs" />
          </div>
        </aside>
      }

      @if (sidebar) {
        <div class="erp-page-layout__toggle-zone" (click)="toggleSidebar()">
          <erp-button
            [config]="collapsed ? expandButtonConfig : collapseButtonConfig"
            style="pointer-events: none;"
          />
        </div>
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

    .erp-page-layout__sidebar {
      height: 100%;
      overflow: hidden;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                  min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
      border-inline-end: 1px solid var(--tui-border-normal);
      background: var(--tui-background-elevation-1);
    }

    .erp-page-layout--collapsed .erp-page-layout__sidebar {
      border-inline-end: none;
    }

    .erp-page-layout__sidebar-content {
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      opacity: 1;
      transition: opacity 0.2s ease;
    }

    .erp-page-layout__sidebar-content--hidden {
      opacity: 0;
      pointer-events: none;
    }

    .erp-page-layout__toggle-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 100%;
      flex-shrink: 0;
      z-index: 10;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      border-inline-start: 1px solid var(--tui-border-normal);
      border-inline-end: 1px solid var(--tui-border-normal);
      background: var(--tui-background-elevation-1);
    }

    .erp-page-layout__toggle-zone:hover {
      background: var(--tui-background-neutral-1-hover);
    }

    .erp-page-layout__toggle-zone:hover erp-button {
      transform: scale(1.1);
      transition: transform 0.15s ease;
    }

    .erp-page-layout--collapsed .erp-page-layout__toggle-zone {
      border-inline-start: none;
    }

    .erp-page-layout__main {
      flex: 1;
      padding: 0 1rem;
      height: 100%;
      overflow: auto;
      min-width: 0;
    }
  `],
})
export class ErpPageLayoutComponent {
  readonly config = input.required<ErpPageLayoutConfig>();

  /** Wewnętrzny stan zwinięcia sidebara — używany gdy nie przekazano sidebarCollapsed z zewnątrz. */
  private readonly _internalCollapsed = signal(false);

  protected readonly _leftSidebar = computed(() => this.config().leftSidebar);
  protected readonly _main = computed(() => this.config().main);
  protected readonly _sidebarWidth = computed(() => unwrapSignal(this.config().sidebarWidth) ?? 280);

  protected readonly _collapsed = computed(() => {
    const external = unwrapSignal(this.config().sidebarCollapsed);
    return external ?? this._internalCollapsed();
  });

  protected readonly collapseButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('flat')
      .setSize('xs')
      .setIconStart('@tui.chevron-left')
      .setFn(() => this.toggleSidebar())
  );

  protected readonly expandButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('flat')
      .setSize('xs')
      .setIconStart('@tui.chevron-right')
      .setFn(() => this.toggleSidebar())
  );

  protected toggleSidebar(): void {
    this._internalCollapsed.update((v) => !v);
  }
}
