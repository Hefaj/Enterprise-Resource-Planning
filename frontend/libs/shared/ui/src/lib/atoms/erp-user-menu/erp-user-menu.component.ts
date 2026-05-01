import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { RippleModule } from 'primeng/ripple';

export interface ErpUserMenuItem {
  label: string;
  icon?: string;
  command?: () => void;
}
export interface ErpUserMenu {
  items: ErpUserMenuItem[];
}

@Component({
  selector: 'erp-user-menu',
  imports: [ButtonModule, AvatarModule, MenuModule, RippleModule],
  template: `
    @let _config = config();

    <p-menu
      #menu
      [popup]="true"
      [model]="_config.items"
      appendTo="body"
    >
      <ng-template #end>
        <button
          pRipple
          class="relative overflow-hidden w-full border-0 bg-transparent flex items-start p-2 pl-4 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-none cursor-pointer transition-colors duration-200"
        >
          <p-avatar
            image="https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png"
            class="mr-2"
            shape="circle"
          />
          <span class="inline-flex flex-col items-start">
            <span class="font-bold">Amy Elsner</span>
            <span class="text-sm">Admin</span>
          </span>
        </button>
      </ng-template>
    </p-menu>

    <p-avatar
      [image]="'https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png'"
      shape="circle"
      size="large"
      class="border-2 border-primary-500 m-2 cursor-pointer"
      (click)="menu.toggle($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpUserMenuComponent {
  public config = input.required<ErpUserMenu>();
}
