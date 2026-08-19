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
import { UserOrchestrator, UserRoleGrantVM } from '@erp/identity/data-access';
import { ASSIGN_USER_ROLE_MODAL_ID } from '@erp/identity/util';
import { UsersStore } from '../users.store';
import { IDENTITY_KEYS } from '../../translation';

/** Zakładka "Role" panelu szczegółów użytkownika — tabela `roleGrants` + nadawanie/odbieranie. */
@Component({
  selector: 'erp-identity-user-roles-tab',
  standalone: true,
  imports: [CommonModule, ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, ErpTableComponent],
  template: `
    <div class="flex flex-col h-full w-full gap-2 p-2" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
      <erp-action-toolbar [config]="actionToolbar" />
      <div class="flex-1 min-h-0">
        <erp-table class="block h-full w-full" [config]="tableConfig()" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserRolesTabComponent {
  private readonly _store = inject(UsersStore);
  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(IdentityConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  /** Panel-nadrzędny renderuje tę zakładkę tylko, gdy jakiś użytkownik jest wybrany — patrz
   * `UsersComponent` — więc w praktyce zawsze zdefiniowany. Typowany jako `| undefined`, bo
   * `NgComponentOutlet` (przez który ta zakładka jest osadzana, patrz `ErpTabsComponent`) nie
   * potrafi przyjąć reaktywnego inputu — czyta migawkę wartości, nie `Signal`, więc każda
   * zakładka sama odczytuje bieżący wybór ze wspólnego `UsersStore` zamiast dostawać go jako
   * `@Input`. */
  protected readonly user = computed(() => {
    const uuid = this._store.selectedUuid();
    return uuid ? this._orchestrator.getOne(uuid)() : undefined;
  });

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-user-roles-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('roles')
          .setLabel(IDENTITY_KEYS.users.detail.tabs.roles)
          .setIcon('@tui.shield')
          .addAction((a) =>
            a
              .setId('assign-role')
              .setLabel(IDENTITY_KEYS.users.commands.assignRole.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAssignModal()),
          ),
      )
      .setPinnedActionIds(['assign-role']),
  );

  protected readonly tableConfig = computed(() => {
    const canManage = this.canManage();
    const builder = new ErpTableBuilder<UserRoleGrantVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.roleUuid)
      .setItems(computed(() => this.user()?.roleGrants ?? []))
      .setSelectionMode('none')
      .setEmptyMessage(IDENTITY_KEYS.users.detail.roles.emptyMessage)
      .addColumn((c) =>
        c
          .setId('code')
          .setAccessorFn((row) => row.role?.code ?? row.roleUuid)
          .setHeader(IDENTITY_KEYS.users.detail.roles.columns.role)
          .setSize(200),
      )
      .addColumn((c) =>
        c
          .setId('grantedAt')
          .setAccessorKey('grantedAt')
          .setHeader(IDENTITY_KEYS.users.detail.roles.columns.grantedAt)
          .setSize(160)
          .setCellFormatter((value: Date) => (value ? new Date(value).toLocaleDateString() : '—')),
      )
      .addColumn((c) =>
        c
          .setId('expiresAt')
          .setAccessorKey('expiresAt')
          .setHeader(IDENTITY_KEYS.users.detail.roles.columns.expiresAt)
          .setSize(160)
          .setCellFormatter((value: Date | undefined) => (value ? new Date(value).toLocaleDateString() : '—')),
      );

    if (canManage) {
      builder.addColumn((c) =>
        c
          .setId('actions')
          .setHeader('')
          .setEnableSorting(false)
          .setSize(60)
          .setCell(IdentityRowRemoveCellComponent, { onRemove: (row: UserRoleGrantVM) => this._onRevoke(row) }),
      );
    }

    return builder.build();
  });

  private _openAssignModal(): void {
    const userUuid = this.user()?.uuid;
    if (!userUuid) return;
    this._modalService.open(ASSIGN_USER_ROLE_MODAL_ID, { userUuid });
  }

  private _onRevoke(row: UserRoleGrantVM): void {
    const userUuid = this.user()?.uuid;
    if (!userUuid) return;

    this._confirm
      .confirm({
        title: IDENTITY_KEYS.users.detail.roles.revokeConfirmTitle,
        message: IDENTITY_KEYS.users.detail.roles.revokeConfirmMessage,
        yes: IDENTITY_KEYS.users.detail.roles.revokeConfirmYes,
        no: IDENTITY_KEYS.users.detail.roles.revokeConfirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator
          .revokeRoleAsync({ userUuid, roleUuid: row.roleUuid })
          .catch((err) => console.error('[UserRolesTabComponent] Nie udało się odebrać roli.', err));
      });
  }
}
