import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpTableComponent,
  ErpTableBuilder,
  ErpModalService,
  ErpSelectionState,
} from '@erp/shared/ui';
import { IdentityConfirmDialogService } from '@erp/identity/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { UserOrchestrator, UserRoleGrantVM } from '@erp/identity/data-access';
import { ASSIGN_USER_ROLE_MODAL_ID } from '@erp/identity/util';
import { UsersStore } from '../users.store';
import { USERS_KEYS } from '../translation';

/** Zakładka "Role" panelu szczegółów użytkownika — tabela `roleGrants` + nadawanie/odbieranie.
 * Odbieranie roli jest akcją zaznaczenia w `erp-action-toolbar` (zaznacz wiersz radiem, potem
 * "Odbierz rolę" w toolbarze), nie osobnym przyciskiem w komórce tabeli. */
@Component({
  selector: 'erp-identity-user-roles-tab',
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

  private readonly _selectedRoleUuid = signal<string | null>(null);
  protected readonly selectionCount = computed(() => (this._selectedRoleUuid() ? 1 : 0));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-user-roles-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('roles')
          .setLabel(USERS_KEYS.detail.tabs.roles)
          .setIcon('@tui.shield')
          .addAction((a) =>
            a
              .setId('assign-role')
              .setLabel(USERS_KEYS.commands.assignRole.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAssignModal()),
          ),
      )
      .addSelectionGroup((g) =>
        g
          .setId('role-selection')
          .setLabel(USERS_KEYS.detail.roles.revokeAction)
          .setIcon('@tui.trash-2')
          .addAction((a) =>
            a
              .setId('revoke-role')
              .setLabel(USERS_KEYS.detail.roles.revokeAction)
              .setIcon('@tui.trash-2')
              .setAppearance('warning')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._onRevokeSelected()),
          ),
      )
      .setSelectionCount(this.selectionCount)
      .setSelectionScope(computed(() => (this._selectedRoleUuid() ? 'explicit' : 'none')))
      .setSelectionLabel(USERS_KEYS.detail.tabs.roles)
      .setOnClearSelection(() => this._selectedRoleUuid.set(null))
      .setPinnedActionIds(['assign-role']),
  );

  protected readonly tableConfig = computed(() => {
    const canManage = this.canManage();
    const builder = new ErpTableBuilder<UserRoleGrantVM>()
      .setMode('client')
      .setRowIdAccessor((x) => x.roleUuid)
      .setItems(computed(() => this.user()?.roleGrants ?? []))
      .setSelectionMode(canManage ? 'single' : 'none')
      .setOnSelectionChange((state: ErpSelectionState<UserRoleGrantVM>) => this._selectedRoleUuid.set(state.selectedIds[0] ?? null))
      .setEmptyMessage(USERS_KEYS.detail.roles.emptyMessage)
      .addColumn((c) =>
        c
          .setId('code')
          .setAccessorFn((row) => row.role?.code ?? row.roleUuid)
          .setHeader(USERS_KEYS.detail.roles.columns.role)
          .setSize(200),
      )
      .addColumn((c) =>
        c
          .setId('grantedAt')
          .setAccessorKey('grantedAt')
          .setHeader(USERS_KEYS.detail.roles.columns.grantedAt)
          .setSize(160)
          .setCellFormatter((value: Date) => (value ? new Date(value).toLocaleDateString() : '—')),
      )
      .addColumn((c) =>
        c
          .setId('expiresAt')
          .setAccessorKey('expiresAt')
          .setHeader(USERS_KEYS.detail.roles.columns.expiresAt)
          .setSize(160)
          .setCellFormatter((value: Date | undefined) => (value ? new Date(value).toLocaleDateString() : '—')),
      );

    return builder.build();
  });

  private _openAssignModal(): void {
    const userUuid = this.user()?.uuid;
    if (!userUuid) return;
    this._modalService.open(ASSIGN_USER_ROLE_MODAL_ID, { targetUuids: [userUuid] });
  }

  private _onRevokeSelected(): void {
    const userUuid = this.user()?.uuid;
    const roleUuid = this._selectedRoleUuid();
    if (!userUuid || !roleUuid) return;

    this._confirm
      .confirm({
        title: USERS_KEYS.detail.roles.revokeConfirmTitle,
        message: USERS_KEYS.detail.roles.revokeConfirmMessage,
        yes: USERS_KEYS.detail.roles.revokeConfirmYes,
        no: USERS_KEYS.detail.roles.revokeConfirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator
          .revokeRoleAsync({ uuid: userUuid, roleUuid })
          .then(() => this._selectedRoleUuid.set(null))
          .catch((err) => console.error('[UserRolesTabComponent] Nie udało się odebrać roli.', err));
      });
  }
}
