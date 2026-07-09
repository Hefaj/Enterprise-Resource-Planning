import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TuiButton, TuiIcon, TuiDropdown, TuiDataList } from '@taiga-ui/core';
import { TuiLoader } from '@taiga-ui/core/components/loader';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { TuiDataListDropdownManager } from '@taiga-ui/kit';
import { unwrapSignal, MaybeSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpMenuBarItemComponent } from './erp-menu-bar-item.component';
import { ErpMenuBarConfig, ErpMenuBarItemConfig } from './erp-menu-bar.types';

@Component({
  selector: 'erp-menu-bar',
  standalone: true,
  imports: [
    TuiButton,
    TuiIcon,
    TuiDropdown,
    TuiDataList,
    TuiLoader,
    TuiHintDirective,
    TuiDataListDropdownManager,
    ErpMenuBarItemComponent,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.erp-menu-bar--horizontal]': `_direction() === 'horizontal'`,
    '[class.erp-menu-bar--vertical]': `_direction() === 'vertical'`,
  },
  template: `
    @let dir = _direction();

    @for (item of _items(); track $index) {
      @let labelVal = (unwrap(item.label) | erpTranslate) || '';
      @let subLabelVal = (unwrap(item.subLabel) | erpTranslate) || '';
      @let hintVal = (unwrap(item.hint) | erpTranslate) || '';
      @let isDisabled = unwrap(item.disabled) ?? false;
      @let hasChildren = item.children && item.children.length > 0;
      @let iconEndVal = getIconEnd(item);

      @if (unwrap(item.separator)) {
        @if (dir === 'horizontal') {
          <div class="erp-menu-bar__separator-vertical" role="separator"></div>
        } @else {
          <hr class="erp-menu-bar__separator-horizontal" role="separator" />
        }
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
          [tuiDropdown]="!isDisabled ? dropdown : null"
          [tuiDropdownOpen]="activeDropdownIndex() === $index"
          (tuiDropdownOpenChange)="onOpenChange($event, $index)"
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

          <ng-template #dropdown>
            <tui-data-list tuiDataListDropdownManager>
              @for (child of item.children; track $index) {
                @if (child.separator) {
                  <hr class="erp-menu-bar-item__separator" />
                } @else {
                  <erp-menu-bar-item [config]="child" (closeMenu)="closeAll()" />
                }
              }
            </tui-data-list>
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

    :host.erp-menu-bar--vertical {
      flex-direction: column;
      align-items: stretch;
      width: 100%;
    }

    button[tuiButton] {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5rem;
      text-align: left;
    }

    .erp-menu-bar--vertical button[tuiButton] {
      width: 100%;
    }

    button.erp-menu-bar__button-leaf {
      padding: 0 !important;
      position: relative;
      display: inline-block;
    }

    .erp-menu-bar--vertical button.erp-menu-bar__button-leaf {
      display: block;
      width: 100%;
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

    .erp-menu-bar__separator-horizontal {
      height: 1px;
      border: 0;
      border-top: 1px solid var(--tui-border-normal);
      width: 100%;
      margin: 0.5rem 0;
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

  protected readonly _items = computed(() => this.config().items ?? []);
  protected readonly _direction = computed(() => unwrapSignal(this.config().direction) ?? 'horizontal');

  protected unwrap<T>(val: MaybeSignal<T> | undefined): T | undefined {
    return unwrapSignal(val);
  }

  protected getIconEnd(item: ErpMenuBarItemConfig): string | undefined {
    const hasChildren = item.children && item.children.length > 0;
    if (!hasChildren) {
      return unwrapSignal(item.iconEnd);
    }
    return this._direction() === 'horizontal' ? '@tui.chevron-down' : '@tui.chevron-right';
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

  protected handleDisabledClick(event: MouseEvent, item: ErpMenuBarItemConfig): void {
    if (this.unwrap(item.disabled)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
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
