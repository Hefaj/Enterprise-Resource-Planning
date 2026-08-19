import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpTableComponent,
  ErpTableBuilder,
  ErpModalService,
} from '@erp/shared/ui';
import { IdentityRowRemoveCellComponent, IdentityConfirmDialogService } from '@erp/identity/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { UserOrchestrator, UserPermissionGrantVM } from '@erp/identity/data-access';
import { GRANT_USER_PERMISSION_MODAL_ID } from '@erp/identity/util';
import { UsersStore } from '../users.store';
import { USERS_KEYS } from '../translation';

/** Zakładka "Uprawnienia bezpośrednie" — wyjątek z powodem, nie równoprawna ścieżka obok ról
 * (patrz `docs/backend/identity-authz.md` §2). */
@Component({
  selector: 'erp-identity-user-permissions-tab',
  standalone: true,
  imports: [CommonModule, ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, ErpTableComponent],
  template: `
    <div
      class="flex flex-col h-full w-full gap-2 p-2"
      erpActionToolbarZone
      [erpActionToolbarContext]="actionToolbar"
    >
      <erp-action-toolbar [config]="actionToolbar" />
      <div class="flex-1 min-h-0">
        <erp-table
          class="block h-full w-full"
          [config]="tableConfig()"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPermissionsTabComponent {
  private readonly _store = inject(UsersStore);
  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(IdentityConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  /** Patrz komentarz przy tym samym wzorcu w `UserRolesTabComponent` — `NgComponentOutlet`
   * przyjmuje tylko migawkę wartości, więc zakładka sama czyta bieżący wybór ze store'a. */
  protected readonly user = computed(() => {
    const uuid = this._store.selectedUuid();
    return uuid ? this._orchestrator.getOne(uuid)() : undefined;
  });

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-user-permissions-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('permissions')
          .setLabel(USERS_KEYS.detail.tabs.permissions)
          .setIcon('@tui.key')
          .addAction((a) =>
            a
              .setId('grant-permission')
              .setLabel(USERS_KEYS.commands.grantPermission.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openGrantModal()),
          ),
      )
      .setPinnedActionIds(['grant-permission']),
  );

  protected readonly tableConfig = computed(() => {
    const canManage = this.canManage();
    const builder = new ErpTableBuilder<UserPermissionGrantVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.permissionCode)
      .setItems(computed(() => this.user()?.permissionGrants ?? []))
      .setSelectionMode('none')
      .setEmptyMessage(USERS_KEYS.detail.permissions.emptyMessage)
      .addColumn((c) => c.setId('permissionCode').setAccessorKey('permissionCode').setHeader(USERS_KEYS.detail.permissions.columns.permissionCode).setSize(240))
      .addColumn((c) => c.setId('reason').setAccessorKey('reason').setHeader(USERS_KEYS.detail.permissions.columns.reason).setSize(260))
      .addColumn((c) =>
        c
          .setId('grantedAt')
          .setAccessorKey('grantedAt')
          .setHeader(USERS_KEYS.detail.permissions.columns.grantedAt)
          .setSize(160)
          .setCellFormatter((value: Date) => (value ? new Date(value).toLocaleDateString() : '—')),
      );

    if (canManage) {
      builder.addColumn((c) =>
        c
          .setId('actions')
          .setHeader('')
          .setEnableSorting(false)
          .setSize(60)
          .setCell(IdentityRowRemoveCellComponent, { onRemove: (row: UserPermissionGrantVM) => this._onRevoke(row) }),
      );
    }

    return builder.build();
  });

  private _openGrantModal(): void {
    const userUuid = this.user()?.uuid;
    if (!userUuid) return;
    this._modalService.open(GRANT_USER_PERMISSION_MODAL_ID, { userUuid });
  }

  private _onRevoke(row: UserPermissionGrantVM): void {
    const userUuid = this.user()?.uuid;
    if (!userUuid) return;

    this._confirm
      .confirm({
        title: USERS_KEYS.detail.permissions.revokeConfirmTitle,
        message: USERS_KEYS.detail.permissions.revokeConfirmMessage,
        yes: USERS_KEYS.detail.permissions.revokeConfirmYes,
        no: USERS_KEYS.detail.permissions.revokeConfirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator
          .revokePermissionAsync({ userUuid, permissionCode: row.permissionCode })
          .catch((err) => console.error('[UserPermissionsTabComponent] Nie udało się odebrać uprawnienia.', err));
      });
  }
}
