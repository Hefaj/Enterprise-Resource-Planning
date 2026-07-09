import { ChangeDetectionStrategy, Component, computed, input, signal, Directive, Input } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { TuiActiveZone } from '@taiga-ui/cdk';
import { TuiButton, TuiIcon, TuiDropdown, TuiDataList } from '@taiga-ui/core';
import { TuiLoader } from '@taiga-ui/core/components/loader';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { unwrapSignal, MaybeSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpMenuBarConfig, ErpMenuBarItemConfig } from './erp-menu-bar.types';

@Directive({
  selector: '[erpActiveZoneExporter]',
  standalone: true,
  exportAs: 'erpActiveZoneExporter',
})
export class ErpActiveZoneExporter {
  @Input() set erpActiveZoneParent(parent: TuiActiveZone | null | undefined) {
    this.activeZone.tuiActiveZoneParentSetter = parent ?? null;
  }
  constructor(public activeZone: TuiActiveZone) {}
}

@Component({
  selector: 'erp-menu-bar',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
    TuiActiveZone,
    ErpActiveZoneExporter,
    TuiButton,
    TuiIcon,
    TuiDropdown,
    TuiDataList,
    TuiLoader,
    TuiHintDirective,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of _items(); track $index) {
      @let labelVal = (unwrap(item.label) | erpTranslate) || '';
      @let subLabelVal = (unwrap(item.subLabel) | erpTranslate) || '';
      @let hintVal = (unwrap(item.hint) | erpTranslate) || '';
      @let isDisabled = unwrap(item.disabled) ?? false;
      @let hasChildren = item.children && item.children.length > 0;
      @let iconEndVal = getIconEnd(item);

      @if (unwrap(item.separator)) {
        <div class="erp-menu-bar__separator-vertical" role="separator"></div>
      } @else if (hasChildren) {
        <button
          tuiButton
          type="button"
          appearance="flat"
          [disabled]="false"
          (click)="handleDisabledClick($event, item)"
          [iconStart]="unwrap(item.iconStart) ?? ''"
          [iconEnd]="iconEndVal ?? ''"
          tuiDropdownAuto
          [tuiDropdown]="!isDisabled ? subMenuTmp : null"
          [tuiDropdownOpen]="activeDropdownIndex() === $index"
          (tuiDropdownOpenChange)="onOpenChange($event, $index)"
          tuiActiveZone
          #topActiveZone="tuiActiveZone"
          [class.erp-menu-bar__item--disabled]="isDisabled"
          [class.erp-menu-bar__item--warning]="unwrap(item.appearance) === 'warning'"
          [class.erp-menu-bar__item--info]="unwrap(item.appearance) === 'info'"
        >
          <div class="erp-menu-bar__content">
            <span class="erp-menu-bar__label">{{ labelVal }}</span>
            @if (subLabelVal) {
              <span class="erp-menu-bar__sub-label">{{ subLabelVal }}</span>
            }
          </div>

          @if (hintVal) {
            <tui-icon
              icon="@tui.info"
              [tuiHint]="hintVal"
              class="erp-menu-bar__hint-icon"
              (click)="$event.stopPropagation(); $event.preventDefault()"
            />
          }

          <ng-template #subMenuTmp>
            <ng-container *ngTemplateOutlet="menuList; context: { items: item.children, parentActiveZone: topActiveZone }"></ng-container>
          </ng-template>
        </button>
      } @else {
        <button
          tuiButton
          type="button"
          appearance="flat"
          [disabled]="false"
          (click)="handleItemClick(item, $index, $event)"
          [class.erp-menu-bar__item--disabled]="isDisabled"
          [class.erp-menu-bar__item--warning]="unwrap(item.appearance) === 'warning'"
          [class.erp-menu-bar__item--info]="unwrap(item.appearance) === 'info'"
          class="erp-menu-bar__button-leaf"
        >
          <tui-loader [loading]="loadingStates()[$index] || false" size="s" [inheritColor]="true" [overlay]="true" class="erp-menu-bar__loader">
            @if (unwrap(item.iconStart)) {
              <tui-icon [icon]="unwrap(item.iconStart)!" class="erp-menu-bar__icon-start" />
            }
            <div class="erp-menu-bar__content">
              <span class="erp-menu-bar__label">{{ labelVal }}</span>
              @if (subLabelVal) {
                <span class="erp-menu-bar__sub-label">{{ subLabelVal }}</span>
              }
            </div>
            @if (hintVal) {
              <tui-icon
                icon="@tui.info"
                [tuiHint]="hintVal"
                class="erp-menu-bar__hint-icon"
                (click)="$event.stopPropagation(); $event.preventDefault()"
              />
            }
            @if (iconEndVal) {
              <tui-icon [icon]="iconEndVal" class="erp-menu-bar__icon-end" />
            }
          </tui-loader>
        </button>
      }
    }

    <!-- Recursive menu list template -->
    <ng-template #menuList let-items="items" let-parentActiveZone="parentActiveZone">
      <tui-data-list [tuiActiveZoneParent]="parentActiveZone" #listActiveZone="tuiActiveZone">
        @for (child of items; track $index) {
          @if (child.separator) {
            <hr class="erp-menu-bar-item__separator" />
          } @else {
            @let childLabelVal = (unwrap(child.label) | erpTranslate) || '';
            @let childSubLabelVal = (unwrap(child.subLabel) | erpTranslate) || '';
            @let childHintVal = (unwrap(child.hint) | erpTranslate) || '';
            @let childIsDisabled = unwrap(child.disabled) ?? false;
            @let childHasChildren = child.children && child.children.length > 0;
            @let childIconEndVal = unwrap(child.iconEnd);

            @if (childHasChildren) {
              <button
                tuiOption
                type="button"
                [disabled]="childIsDisabled"
                iconEnd="@tui.chevron-right"
                tuiDropdownAlign="end"
                tuiDropdownLimitWidth="auto"
                tuiDropdownHover
                tuiDropdownSided
                [tuiDropdown]="childSubMenu"
                [erpActiveZoneParent]="listActiveZone"
                erpActiveZoneExporter
                #exporter="erpActiveZoneExporter"
                [class.erp-menu-bar-item--warning]="unwrap(child.appearance) === 'warning'"
                [class.erp-menu-bar-item--info]="unwrap(child.appearance) === 'info'"
              >
                @if (unwrap(child.iconStart)) {
                  <tui-icon [icon]="unwrap(child.iconStart)!" class="erp-menu-bar-item__icon-start" />
                }
                
                <div class="erp-menu-bar-item__content">
                  <span class="erp-menu-bar-item__label">{{ childLabelVal }}</span>
                  @if (childSubLabelVal) {
                    <span class="erp-menu-bar-item__sub-label">{{ childSubLabelVal }}</span>
                  }
                </div>

                @if (childHintVal) {
                  <tui-icon
                    icon="@tui.info"
                    [tuiHint]="childHintVal"
                    class="erp-menu-bar-item__hint-icon"
                    (click)="$event.stopPropagation(); $event.preventDefault()"
                  />
                }

                <ng-template #childSubMenu>
                  <ng-container *ngTemplateOutlet="menuList; context: { items: child.children, parentActiveZone: exporter.activeZone }"></ng-container>
                </ng-template>
              </button>
            } @else {
              <button
                tuiOption
                type="button"
                [disabled]="false"
                (click)="handleNestedItemClick(child, $event)"
                [class.erp-menu-bar-item--disabled]="childIsDisabled"
                [class.erp-menu-bar-item--warning]="unwrap(child.appearance) === 'warning'"
                [class.erp-menu-bar-item--info]="unwrap(child.appearance) === 'info'"
                class="erp-menu-bar-item__button-leaf"
              >
                <tui-loader [loading]="isItemLoading(child)" size="s" [inheritColor]="true" [overlay]="true" class="erp-menu-bar-item__loader">
                  @if (unwrap(child.iconStart)) {
                    <tui-icon [icon]="unwrap(child.iconStart)!" class="erp-menu-bar-item__icon-start" />
                  }
                  
                  <div class="erp-menu-bar-item__content">
                    <span class="erp-menu-bar-item__label">{{ childLabelVal }}</span>
                    @if (childSubLabelVal) {
                      <span class="erp-menu-bar-item__sub-label">{{ childSubLabelVal }}</span>
                    }
                  </div>

                  @if (childHintVal) {
                    <tui-icon
                      icon="@tui.info"
                      [tuiHint]="childHintVal"
                      class="erp-menu-bar-item__hint-icon"
                      (click)="$event.stopPropagation(); $event.preventDefault()"
                    />
                  }

                  @if (childIconEndVal) {
                    <tui-icon [icon]="childIconEndVal" class="erp-menu-bar-item__icon-end" />
                  }
                </tui-loader>
              </button>
            }
          }
        }
      </tui-data-list>
    </ng-template>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--tui-background-base);
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-m);
      padding: 0.5rem;
    }

    button[tuiButton] {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5rem;
      text-align: left;
      min-width: 200px;
    }

    button.erp-menu-bar__button-leaf {
      padding: 0 !important;
      position: relative;
      display: inline-block;
    }

    .erp-menu-bar__loader {
      width: 100%;
      height: 100%;
    }

    ::ng-deep .erp-menu-bar__loader .t-content {
      display: flex !important;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5rem;
      width: 100%;
      height: 100%;
      padding: 0.5rem 1rem;
      min-height: 2.75rem;
      box-sizing: border-box;
    }

    .erp-menu-bar__content {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      flex-grow: 1;
    }

    .erp-menu-bar__label {
      font: var(--tui-typography-ui-s);
      font-weight: 500;
    }

    .erp-menu-bar__sub-label {
      font: var(--tui-typography-ui-2xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    .erp-menu-bar__hint-icon {
      color: var(--tui-text-tertiary);
      cursor: pointer;
      font-size: 1rem;
      transition: color 0.2s;
    }

    .erp-menu-bar__hint-icon:hover {
      color: var(--tui-text-secondary);
    }

    /* Separatory */
    .erp-menu-bar__separator-vertical {
      width: 1px;
      align-self: stretch;
      background-color: var(--tui-border-normal);
      margin: 0.25rem 0.5rem;
    }

    /* erp-menu-bar-item styles */
    .erp-menu-bar-item__loader {
      width: 100%;
      height: 100%;
    }

    button[tuiOption] {
      display: flex;
      align-items: center;
      width: 100%;
      text-align: left;
      padding: 0.5rem 1rem;
      gap: 0.75rem;
      min-height: 2.75rem;
      min-width: 200px;
    }

    button.erp-menu-bar-item__button-leaf {
      padding: 0 !important;
      display: block;
      position: relative;
    }

    ::ng-deep .erp-menu-bar-item__loader .t-content {
      display: flex !important;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 0.5rem 1rem;
      gap: 0.75rem;
      min-height: 2.75rem;
      box-sizing: border-box;
    }

    .erp-menu-bar-item__icon-start {
      color: var(--tui-text-secondary);
      flex-shrink: 0;
    }

    .erp-menu-bar-item__content {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    .erp-menu-bar-item__label {
      font: var(--tui-typography-ui-s);
      color: inherit;
    }

    .erp-menu-bar-item__sub-label {
      font: var(--tui-typography-ui-xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    .erp-menu-bar-item__hint-icon {
      color: var(--tui-text-tertiary);
      cursor: pointer;
      flex-shrink: 0;
      transition: color 0.2s;
    }

    .erp-menu-bar-item__hint-icon:hover {
      color: var(--tui-text-secondary);
    }

    .erp-menu-bar-item__icon-end {
      color: var(--tui-text-secondary);
      flex-shrink: 0;
    }

    /* Wygląd - disabled */
    .erp-menu-bar-item--disabled {
      opacity: var(--tui-disabled-opacity) !important;
      cursor: not-allowed !important;
      pointer-events: auto !important;
    }
    .erp-menu-bar-item--disabled:hover {
      background: transparent !important;
    }

    /* Wygląd - warning */
    .erp-menu-bar-item--warning {
      color: var(--tui-text-negative) !important;
    }
    .erp-menu-bar-item--warning .erp-menu-bar-item__icon-start,
    .erp-menu-bar-item--warning .erp-menu-bar-item__icon-end {
      color: var(--tui-text-negative) !important;
    }

    /* Wygląd - info */
    .erp-menu-bar-item--info {
      color: var(--tui-text-action) !important;
    }
    .erp-menu-bar-item--info .erp-menu-bar-item__icon-start,
    .erp-menu-bar-item--info .erp-menu-bar-item__icon-end {
      color: var(--tui-text-action) !important;
    }

    .erp-menu-bar-item__separator {
      margin: 0.25rem 0;
      border: 0;
      border-top: 1px solid var(--tui-border-normal);
      opacity: 0.6;
    }

    /* Kolorystyka */
    .erp-menu-bar__item--disabled {
      opacity: var(--tui-disabled-opacity) !important;
      cursor: not-allowed !important;
      pointer-events: auto !important;
    }
    .erp-menu-bar__item--disabled:hover {
      background: transparent !important;
    }

    .erp-menu-bar__item--warning {
      color: var(--tui-text-negative) !important;
    }

    .erp-menu-bar__item--info {
      color: var(--tui-text-action) !important;
    }
  `]
})
export class ErpMenuBarComponent {
  readonly config = input.required<ErpMenuBarConfig>();

  protected readonly activeDropdownIndex = signal<number | null>(null);
  protected readonly loadingStates = signal<Record<number, boolean>>({});
  protected readonly loadingItems = signal<Set<ErpMenuBarItemConfig>>(new Set());

  protected readonly _items = computed(() => this.config().items ?? []);

  protected unwrap<T>(val: MaybeSignal<T> | undefined): T | undefined {
    return unwrapSignal(val);
  }

  protected getIconEnd(item: ErpMenuBarItemConfig): string | undefined {
    const hasChildren = item.children && item.children.length > 0;
    if (!hasChildren) {
      return unwrapSignal(item.iconEnd);
    }
    return '@tui.chevron-down';
  }

  protected onOpenChange(open: boolean, index: number): void {
    if (open) {
      this.activeDropdownIndex.set(index);
    } else if (this.activeDropdownIndex() === index) {
      this.activeDropdownIndex.set(null);
    }
  }

  protected closeAll(): void {
    this.activeDropdownIndex.set(null);
  }

  protected isItemLoading(item: ErpMenuBarItemConfig): boolean {
    return this.loadingItems().has(item);
  }

  protected handleDisabledClick(event: MouseEvent, item: ErpMenuBarItemConfig): void {
    if (this.unwrap(item.disabled)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  protected handleParentClick(event: MouseEvent, item: ErpMenuBarItemConfig): void {
    if (this.unwrap(item.disabled)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    event.stopPropagation();
  }

  protected async handleNestedItemClick(item: ErpMenuBarItemConfig, event: MouseEvent): Promise<void> {
    if (this.unwrap(item.disabled)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const fn = item.fn;
    const closeOnClick = this.unwrap(item.closeOnClick) ?? true;

    if (!fn) {
      if (closeOnClick) {
        this.closeAll();
      }
      return;
    }

    if (this.loadingItems().has(item)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = fn();
    if (result instanceof Promise) {
      this.loadingItems.update(set => {
        const next = new Set(set);
        next.add(item);
        return next;
      });
      try {
        await result;
      } finally {
        this.loadingItems.update(set => {
          const next = new Set(set);
          next.delete(item);
          return next;
        });
        if (closeOnClick) {
          this.closeAll();
        }
      }
    } else {
      if (closeOnClick) {
        this.closeAll();
      }
    }
  }

  protected async handleItemClick(item: ErpMenuBarItemConfig, index: number, event: MouseEvent): Promise<void> {
    if (this.unwrap(item.disabled)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const fn = item.fn;
    if (!fn) return;

    if (this.loadingStates()[index]) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = fn();
    if (result instanceof Promise) {
      this.loadingStates.update(s => ({ ...s, [index]: true }));
      try {
        await result;
      } finally {
        this.loadingStates.update(s => ({ ...s, [index]: false }));
      }
    }
  }
}


