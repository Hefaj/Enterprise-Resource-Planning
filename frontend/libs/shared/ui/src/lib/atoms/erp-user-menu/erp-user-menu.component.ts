import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { RippleModule } from 'primeng/ripple';
import { ErpUserMenuConfig } from './erp-user-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-user-menu',
  standalone: true,
  imports: [ButtonModule, AvatarModule, MenuModule, RippleModule],
  template: `
    @let _items = items();
    @let _userName = userName();
    @let _userRole = userRole();
    @let _userImage = userImage();

    <p-menu
      #menu
      [popup]="true"
      [model]="_items || []"
      appendTo="body"
    >
      <ng-template #end>
        <button
          pRipple
          class="relative overflow-hidden w-full border-0 bg-transparent flex items-start p-2 pl-4 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-none cursor-pointer transition-colors duration-200"
        >
          <p-avatar
            [image]="_userImage || 'https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png'"
            class="mr-2"
            shape="circle"
          />
          <span class="inline-flex flex-col items-start">
            <span class="font-bold">{{ _userName || 'Guest' }}</span>
            <span class="text-sm">{{ _userRole || 'User' }}</span>
          </span>
        </button>
      </ng-template>
    </p-menu>

    <p-avatar
      [image]="_userImage || 'https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png'"
      shape="circle"
      size="large"
      class="border-2 border-primary-500 m-2 cursor-pointer"
      (click)="menu.toggle($event)"
    />
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
