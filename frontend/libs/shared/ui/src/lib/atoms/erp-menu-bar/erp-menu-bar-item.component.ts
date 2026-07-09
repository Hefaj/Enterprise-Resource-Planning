import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TuiIcon, TuiDropdown, TuiDataList } from '@taiga-ui/core';
import { TuiLoader } from '@taiga-ui/core/components/loader';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { TuiDataListDropdownManager } from '@taiga-ui/kit';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpMenuBarItemConfig } from './erp-menu-bar.types';

@Component({
  selector: 'erp-menu-bar-item',
  standalone: true,
  imports: [
    TuiIcon,
    TuiDropdown,
    TuiDataList,
    TuiLoader,
    TuiHintDirective,
    TuiDataListDropdownManager,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let labelVal = (_label() | erpTranslate) || '';
    @let subLabelVal = (_subLabel() | erpTranslate) || '';
    @let hintVal = (_hint() | erpTranslate) || '';
    @let hasChildren = _children() && _children()!.length > 0;

    @if (hasChildren) {
      <button
        tuiOption
        type="button"
        [disabled]="false"
        (click)="handleDisabledClick($event)"
        iconEnd="@tui.chevron-right"
        tuiDropdownAlign="end"
        tuiDropdownLimitWidth="auto"
        tuiDropdownHover
        tuiDropdownSided
        [tuiDropdown]="!_disabled() ? subMenu : null"
        [class.erp-menu-bar-item--disabled]="_disabled()"
        [class.erp-menu-bar-item--warning]="_appearance() === 'warning'"
        [class.erp-menu-bar-item--info]="_appearance() === 'info'"
      >
        @if (_iconStart()) {
          <tui-icon [icon]="_iconStart()!" class="erp-menu-bar-item__icon-start" />
        }
        
        <div class="erp-menu-bar-item__content">
          <span class="erp-menu-bar-item__label">{{ labelVal }}</span>
          @if (subLabelVal) {
            <span class="erp-menu-bar-item__sub-label">{{ subLabelVal }}</span>
          }
        </div>

        @if (hintVal) {
          <tui-icon
            icon="@tui.info"
            [tuiHint]="hintVal"
            class="erp-menu-bar-item__hint-icon"
            (click)="$event.stopPropagation(); $event.preventDefault()"
          />
        }

        <ng-template #subMenu>
          <tui-data-list tuiDataListDropdownManager>
            @for (child of _children(); track $index) {
              @if (child.separator) {
                <hr class="erp-menu-bar-item__separator" />
              } @else {
                <erp-menu-bar-item [config]="child" (closeMenu)="closeMenu.emit()" />
              }
            }
          </tui-data-list>
        </ng-template>
      </button>
    } @else {
      <button
        tuiOption
        type="button"
        [disabled]="false"
        (click)="handleClick($event)"
        [class.erp-menu-bar-item--disabled]="_disabled()"
        [class.erp-menu-bar-item--warning]="_appearance() === 'warning'"
        [class.erp-menu-bar-item--info]="_appearance() === 'info'"
        class="erp-menu-bar-item__button-leaf"
      >
        <tui-loader [loading]="_loadingCombined()" size="s" [inheritColor]="true" [overlay]="true" class="erp-menu-bar-item__loader">
          @if (_iconStart()) {
            <tui-icon [icon]="_iconStart()!" class="erp-menu-bar-item__icon-start" />
          }
          
          <div class="erp-menu-bar-item__content">
            <span class="erp-menu-bar-item__label">{{ labelVal }}</span>
            @if (subLabelVal) {
              <span class="erp-menu-bar-item__sub-label">{{ subLabelVal }}</span>
            }
          </div>

          @if (hintVal) {
            <tui-icon
              icon="@tui.info"
              [tuiHint]="hintVal"
              class="erp-menu-bar-item__hint-icon"
              (click)="$event.stopPropagation(); $event.preventDefault()"
            />
          }

          @if (_iconEnd()) {
            <tui-icon [icon]="_iconEnd()!" class="erp-menu-bar-item__icon-end" />
          }
        </tui-loader>
      </button>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

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
  `]
})
export class ErpMenuBarItemComponent {
  readonly config = input.required<ErpMenuBarItemConfig>();
  readonly closeMenu = output<void>();

  protected readonly internalLoading = signal(false);

  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _subLabel = computed(() => unwrapSignal(this.config().subLabel));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected readonly _iconEnd = computed(() => unwrapSignal(this.config().iconEnd));
  protected readonly _disabled = computed(() => unwrapSignal(this.config().disabled) ?? false);
  protected readonly _appearance = computed(() => unwrapSignal(this.config().appearance) ?? 'normal');
  protected readonly _closeOnClick = computed(() => unwrapSignal(this.config().closeOnClick) ?? true);
  protected readonly _children = computed(() => this.config().children);

  protected readonly _loadingCombined = computed(() => this.internalLoading());

  protected handleDisabledClick(event: MouseEvent): void {
    if (this._disabled()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  protected async handleClick(event: MouseEvent): Promise<void> {
    if (this._disabled()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const fn = this.config().fn;
    if (!fn) {
      if (this._closeOnClick()) {
        this.closeMenu.emit();
      }
      return;
    }

    if (this._loadingCombined()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = fn();
    if (result instanceof Promise) {
      this.internalLoading.set(true);
      try {
        await result;
      } finally {
        this.internalLoading.set(false);
        if (this._closeOnClick()) {
          this.closeMenu.emit();
        }
      }
    } else {
      if (this._closeOnClick()) {
        this.closeMenu.emit();
      }
    }
  }
}
