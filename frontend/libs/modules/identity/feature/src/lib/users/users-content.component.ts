import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpModalService,
  ErpBatchMetadata,
  erpBuildBatchTargets,
  erpSelectionScopeCount,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { UserOrchestrator, SearchUserAccountRequest, BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest } from '@erp/identity/data-access';
import { IdentityConfirmDialogService } from '@erp/identity/ui';
import { ASSIGN_USER_ROLE_MODAL_ID, GRANT_USER_PERMISSION_MODAL_ID } from '@erp/identity/util';

import { UsersStore } from './users.store';
import { IdentityUsersTableComponent } from './components/identity-users-table.component';
import { USERS_KEYS } from './translation';

/** Nagłówek + pasek akcji + tabela listy użytkowników. Zaznaczenie wielokrotne (checkboxy)
 * napędza akcje masowe toolbara (nadaj rolę/uprawnienie/wymuś wylogowanie na całym zasięgu —
 * patrz `docs/frontend/selection-scope.md`); zaznaczenie DOKŁADNIE jednego wiersza pokazuje
 * dodatkowo panel zakładek w sąsiednim obszarze (`rightPanel`, `UsersStore.selectedUuid`). */
@Component({
  selector: 'erp-identity-users-content',
  standalone: true,
  imports: [ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective, IdentityUsersTableComponent],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div
        class="flex-1 min-h-0 flex flex-col gap-2"
        erpActionToolbarZone
        [erpActionToolbarContext]="actionToolbar"
      >
        <erp-action-toolbar [config]="actionToolbar" />

        <div class="flex-1 min-h-0">
          <erp-identity-users-table
            stateKey="identity-users"
            [filters]="store.filters()"
            (loadingChange)="store.setLoading($event)"
            (selectionChange)="store.setSelection($event)"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersContentComponent {
  protected readonly store = inject(UsersStore);

  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(IdentityConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  private readonly _table = viewChild(IdentityUsersTableComponent);

  protected readonly selectionCount = computed(() => erpSelectionScopeCount(this.store.scope()));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-users-toolbar')
      .addSelectionGroup((g) =>
        g
          .setId('user-bulk')
          .setLabel(USERS_KEYS.title)
          .setIcon('@tui.users')
          .addAction((a) =>
            a
              .setId('assign-role')
              .setLabel(USERS_KEYS.commands.assignRole.label)
              .setIcon('@tui.shield')
              .setAppearance('success')
              .setHidden(computed(() => !this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage)))
              .setFn(() => this._openAssignRoleModal()),
          )
          .addAction((a) =>
            a
              .setId('grant-permission')
              .setLabel(USERS_KEYS.commands.grantPermission.label)
              .setIcon('@tui.key')
              .setAppearance('success')
              .setHidden(computed(() => !this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage)))
              .setFn(() => this._openGrantPermissionModal()),
          )
          .addAction((a) =>
            a
              .setId('force-logout')
              .setLabel(USERS_KEYS.detail.forceLogout.label)
              .setIcon('@tui.log-out')
              .setAppearance('warning')
              .setHidden(computed(() => !this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage)))
              .setFn(() => this._onForceLogout()),
          ),
      )
      .setSelectionCount(this.selectionCount)
      .setSelectionScope(this.store.scopeKind)
      .setSelectionLabel(USERS_KEYS.title)
      .setOnClearSelection(() => {
        this.store.clearSelection();
        this._table()?.clearSelection();
      })
      .setPinnedActionIds(['assign-role', 'grant-permission', 'force-logout']),
  );

  private _openAssignRoleModal(): void {
    this._modalService.open<BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, ErpBatchMetadata>(
      ASSIGN_USER_ROLE_MODAL_ID,
      erpBuildBatchTargets<SearchUserAccountRequest>(this.store.scope()),
      { targetCount: this.selectionCount() },
    );
  }

  private _openGrantPermissionModal(): void {
    this._modalService.open<BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest, ErpBatchMetadata>(
      GRANT_USER_PERMISSION_MODAL_ID,
      erpBuildBatchTargets<SearchUserAccountRequest>(this.store.scope()),
      { targetCount: this.selectionCount() },
    );
  }

  private _onForceLogout(): void {
    this._confirm
      .confirm({
        title: USERS_KEYS.detail.forceLogout.confirmTitle,
        message: USERS_KEYS.detail.forceLogout.confirmMessage,
        yes: USERS_KEYS.detail.forceLogout.confirmYes,
        no: USERS_KEYS.detail.forceLogout.confirmNo,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._orchestrator
          .forceLogoutMultipleAsync({ ...erpBuildBatchTargets<SearchUserAccountRequest>(this.store.scope()), templateCommand: {} })
          .catch((err: unknown) => console.error('[UsersContentComponent] Nie udało się wymusić wylogowania.', err));
      });
  }
}
