import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ErpActionToolbarBuilder, ErpActionToolbarComponent, ErpActionToolbarContextDirective, ErpActionToolbarZoneDirective, ErpModalService } from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { CREATE_ROLE_MODAL_ID } from '@erp/identity/util';

import { RolesStore } from './roles.store';
import { IdentityRolesTableComponent } from './components/identity-roles-table.component';
import { ROLES_KEYS } from './translation';

/** Nagłówek + pasek akcji ("Nowa rola") + tabela ról (wybór pojedynczy, radio). */
@Component({
  selector: 'erp-identity-roles-content',
  standalone: true,
  imports: [ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, IdentityRolesTableComponent],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div
        class="flex-1 min-h-0 flex flex-col gap-2"
        erpActionToolbarZone
        [erpActionToolbarContext]="actionToolbar"
      >
        <erp-action-toolbar [config]="actionToolbar" />

        <div class="flex-1 min-h-0">
          <erp-identity-roles-table
            (loadingChange)="store.setLoading($event)"
            (selectionChange)="store.selectRole($event)"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesContentComponent {
  protected readonly store = inject(RolesStore);

  private readonly _modalService = inject(ErpModalService);
  private readonly _permissionStore = inject(PermissionStore);

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.RoleManage));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-roles-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('roles')
          .setLabel(ROLES_KEYS.title)
          .setIcon('@tui.shield')
          .addAction((a) =>
            a
              .setId('create-role')
              .setLabel(ROLES_KEYS.commands.create.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => {
                this._modalService.open(CREATE_ROLE_MODAL_ID, {});
              }),
          ),
      )
      .setPinnedActionIds(['create-role']),
  );
}
