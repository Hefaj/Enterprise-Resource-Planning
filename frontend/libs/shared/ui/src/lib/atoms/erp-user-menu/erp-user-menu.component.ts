import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiDropdown, TuiDataList, TuiOption } from '@taiga-ui/core';
import { ErpUserMenuConfig } from './erp-user-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-user-menu',
  standalone: true,
  imports: [TuiAvatar, TuiDropdown, TuiDataList, TuiOption],
  template: `
    @let _items = items();
    @let _userName = userName();
    @let _userRole = userRole();
    @let _userImage = userImage();

    <div class="relative inline-block">
      <!-- Avatar Trigger button -->
      <div
        tuiAvatar
        size="l"
        class="border-2 border-slate-200 cursor-pointer rounded-full"
        [tuiDropdown]="menuContent"
        [tuiDropdownAlign]="'end'"
      >
        <img
          [attr.alt]="_userName || 'User'"
          [attr.src]="_userImage || 'https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png'"
        />
      </div>

      <!-- Dropdown Content Template -->
      <ng-template #menuContent>
        <div class="flex flex-col min-w-56 p-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-slate-100 dark:border-zinc-700">
          
          <!-- User info header -->
          <div class="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-zinc-700">
            <div
              tuiAvatar
              size="m"
              class="rounded-full"
            >
              <img
                [attr.alt]="_userName || 'User'"
                [attr.src]="_userImage || 'https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png'"
              />
            </div>
            <div class="flex flex-col items-start leading-tight">
              <span class="font-bold text-slate-800 dark:text-zinc-100 text-sm">{{ _userName || 'Guest' }}</span>
              <span class="text-xs text-slate-500 dark:text-zinc-400">{{ _userRole || 'User' }}</span>
            </div>
          </div>

          <!-- Menu items list -->
          <tui-data-list class="mt-1">
            @for (item of _items || []; track item.label) {
              <button
                tuiOption
                type="button"
                [disabled]="!!item.disabled"
                (click)="item.command ? item.command({ item: item }) : null"
                class="w-full text-left justify-start"
              >
                @if (item.icon) {
                  <i [class]="item.icon + ' mr-2 text-slate-500'"></i>
                }
                <span class="text-sm text-slate-700 dark:text-zinc-300">{{ item.label }}</span>
              </button>
            }
          </tui-data-list>
        </div>
      </ng-template>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpUserMenuComponent {
  public config = input.required<ErpUserMenuConfig>();

  protected items = computed(() => unwrapSignal(this.config().items));
  protected userName = computed(() => unwrapSignal(this.config().userName));
  protected userRole = computed(() => unwrapSignal(this.config().userRole));
  protected userImage = computed(() => unwrapSignal(this.config().userImage));
}

