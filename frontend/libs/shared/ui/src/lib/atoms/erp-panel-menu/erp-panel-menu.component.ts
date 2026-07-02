import { ChangeDetectionStrategy, Component, input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TuiAsideComponent, TuiAsideItemDirective, TuiAsideGroupComponent } from '@taiga-ui/layout';
import { TuiChevron, TuiFade } from '@taiga-ui/kit';
import { TuiLink } from '@taiga-ui/core';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpPanelMenuConfig } from './erp-panel-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-panel-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TuiAsideComponent,
    TuiAsideItemDirective,
    TuiAsideGroupComponent,
    TuiChevron,
    TuiFade,
    ErpTranslatePipe,
  ],
  template: `
    <aside [tuiNavigationAside]="true" class="w-full h-full border-0 bg-transparent">
      @for (item of items() || []; track $index) {
        @if (item.items && item.items.length > 0) {
          <tui-aside-group [open]="openGroupIndex() === $index" (openChange)="toggleGroup($index, $event)">
            <button
              [iconStart]="item.icon || ''"
              tuiAsideItem
              tuiChevron
              type="button"
            >
              <span tuiFade>{{ (item.label | erpTranslate) || '' }}</span>
            </button>
            <ng-template>
              @for (sub of item.items; track $index) {
                <a
                  [iconStart]="sub.icon || ''"
                  tuiAsideItem
                  [routerLink]="sub.routerLink"
                  routerLinkActive="bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-semibold"
                  [routerLinkActiveOptions]="{ exact: true }"
                  (click)="openGroupIndex.set(null)"
                >
                  <span tuiFade>{{ (sub.label | erpTranslate) || '' }}</span>
                </a>
              }
            </ng-template>
          </tui-aside-group>
        } @else {
          <a
            [iconStart]="item.icon || ''"
            tuiAsideItem
            [routerLink]="item.routerLink"
            routerLinkActive="bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-semibold"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <span tuiFade>{{ (item.label | erpTranslate) || '' }}</span>
          </a>
        }
      }
    </aside>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
    }
    aside[tuiNavigationAside] {
      width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      background: transparent !important;
      overflow-x: hidden !important;
    }
    :host ::ng-deep button[tuiAsideItem],
    :host ::ng-deep a[tuiAsideItem] {
      width: 100% !important;
      box-sizing: border-box !important;
      white-space: normal !important;
      height: auto !important;
      min-height: 2.75rem !important;
      padding-top: 0.5rem !important;
      padding-bottom: 0.5rem !important;
      display: flex !important;
      align-items: center !important;
      text-align: left !important;
    }
    :host ::ng-deep button[tuiAsideItem] span[tuiFade],
    :host ::ng-deep a[tuiAsideItem] span[tuiFade] {
      white-space: normal !important;
      word-break: break-word !important;
      display: block !important;
      width: 100% !important;
    }
    :host ::ng-deep tui-scroll-controls,
    :host ::ng-deep [tuiScrollControls],
    :host ::ng-deep .tui-scroll-controls {
      display: none !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPanelMenuComponent {
  public config = input.required<ErpPanelMenuConfig>();

  protected items = computed(() => unwrapSignal(this.config().items));

  protected openGroupIndex = signal<number | null>(null);

  protected toggleGroup(index: number, open: boolean): void {
    if (open) {
      this.openGroupIndex.set(index);
    } else if (this.openGroupIndex() === index) {
      this.openGroupIndex.set(null);
    }
  }
}
