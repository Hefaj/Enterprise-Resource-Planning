import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiButton, TuiDropdown, TuiDataList, TuiIcon } from '@taiga-ui/core';
import { TuiDataListDropdownManager } from '@taiga-ui/kit';
import { ErpTranslatePipe, unwrapSignal, MaybeSignal } from '@erp/shared/ui';
import { ErpSettingsMenuConfig, ErpSettingsMenuItem } from './erp-settings-menu.types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-settings-menu',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiDropdown,
    TuiDataList,
    TuiDataListDropdownManager,
    TuiIcon,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      tuiIconButton
      type="button"
      appearance="flat"
      size="m"
      tuiDropdownAuto
      [tuiDropdown]="dropdown"
      [title]="'shared.settings.title' | erpTranslate"
      style="cursor: pointer; border-radius: var(--tui-radius-m); border: 1px solid var(--tui-border-normal); background: var(--tui-background-neutral-1); color: var(--tui-text-primary); width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
    >
      <tui-icon icon="@tui.settings" />
    </button>

    <ng-template #dropdown let-close>
      <tui-data-list tuiDataListDropdownManager>
        @for (item of _items(); track item.id) {
          @if (item.separator) {
            <hr class="erp-settings-menu__separator" />
          }

          @let childrenList = _unwrap(item.children);
          @let isDisabled = _unwrap(item.disabled);

          @if (childrenList && childrenList.length > 0) {
            <button
              tuiOption
              type="button"
              iconEnd="@tui.chevron-right"
              tuiDropdownAlign="end"
              tuiDropdownLimitWidth="auto"
              tuiDropdownManual
              tuiDropdownSided
              [tuiDropdown]="subMenu"
              [disabled]="isDisabled ?? false"
            >
              @if (_unwrap(item.icon); as icon) {
                <tui-icon [icon]="icon" class="erp-settings-menu__icon" />
              }
              <span class="erp-settings-menu__label">{{ (_unwrap(item.label) | erpTranslate) || '' }}</span>

              <ng-template #subMenu>
                <tui-data-list>
                  @for (child of childrenList; track child.id) {
                    @let isChildDisabled = _unwrap(child.disabled);
                    <button
                      tuiOption
                      type="button"
                      [disabled]="isChildDisabled ?? false"
                      (click)="handleItemClick(child)"
                    >
                      @if (_unwrap(child.icon); as childIcon) {
                        <tui-icon [icon]="childIcon" class="erp-settings-menu__icon" />
                      }
                      <span class="erp-settings-menu__label">{{ (_unwrap(child.label) | erpTranslate) || '' }}</span>
                      @if (_unwrap(child.active)) {
                        <tui-icon icon="@tui.check" class="erp-settings-menu__check-icon" />
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
              [disabled]="isDisabled ?? false"
              (click)="handleItemClick(item)"
            >
              @if (_unwrap(item.icon); as icon) {
                <tui-icon [icon]="icon" class="erp-settings-menu__icon" />
              }
              <span class="erp-settings-menu__label">{{ (_unwrap(item.label) | erpTranslate) || '' }}</span>
              @if (_unwrap(item.active)) {
                <tui-icon icon="@tui.check" class="erp-settings-menu__check-icon" />
              }
            </button>
          }
        }
      </tui-data-list>
    </ng-template>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .erp-settings-menu__separator {
      margin: 0.25rem 0;
      border: 0;
      border-top: 1px solid var(--tui-border-normal);
      opacity: 0.6;
    }
    .erp-settings-menu__icon {
      margin-inline-end: 0.5rem;
    }
    .erp-settings-menu__label {
      flex-grow: 1;
      text-align: left;
    }
    .erp-settings-menu__check-icon {
      margin-inline-start: 0.5rem;
      color: var(--tui-text-action);
    }
  `]
})
export class ErpSettingsMenuComponent {
  public readonly config = input.required<ErpSettingsMenuConfig>();

  protected readonly _items = computed(() => this.config().items ?? []);

  protected _unwrap<T>(val: MaybeSignal<T> | undefined): T | undefined {
    return unwrapSignal(val);
  }

  protected handleItemClick(item: ErpSettingsMenuItem): void {
    if (item.fn) {
      item.fn();
    }
  }
}
