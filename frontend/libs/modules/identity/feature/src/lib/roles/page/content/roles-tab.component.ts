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
import { BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { ROLE_CREATE_MODAL_ID, ROLE_ADD_PERMISSION_MODAL_ID, ROLE_ADD_MEMBER_MODAL_ID } from '@erp/identity/util';

import { RolesStore } from '../roles.store';
import { IdentityRolesTableComponent } from '../../components/tables/identity-roles-table/identity-roles-table.component';
import { ROLES_KEYS } from '../../translation';

/** Nagłówek + pasek akcji + tabela ról. „Nowa rola" jest akcją sekcyjną (zawsze dostępna);
 * „Dodaj uprawnienie"/„Dodaj rolę składową" są akcjami zaznaczenia — działają na zasięgu
 * zaznaczonych ról (patrz `docs/guides/frontend/selection-scope.md`), tak samo jak analogiczne akcje
 * na stronie użytkowników. */
@Component({
  selector: 'erp-identity-roles-tab',
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
            (selectionChange)="store.setSelection($event)"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesTabComponent {
  protected readonly store = inject(RolesStore);

  private readonly _modalService = inject(ErpModalService);
  private readonly _permissionStore = inject(PermissionStore);

  private readonly _table = viewChild(IdentityRolesTableComponent);

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.RoleManage));
  protected readonly selectionCount = computed(() => erpSelectionScopeCount(this.store.scope()));

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
                this._modalService.open(ROLE_CREATE_MODAL_ID, {});
              }),
          ),
      )
      .addSelectionGroup((g) =>
        g
          .setId('role-bulk')
          .setLabel(ROLES_KEYS.title)
          .setIcon('@tui.key')
          .addAction((a) =>
            a
              .setId('add-permission')
              .setLabel(ROLES_KEYS.commands.addPermission.label)
              .setIcon('@tui.key')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAddPermissionModal()),
          )
          .addAction((a) =>
            a
              .setId('add-member')
              .setLabel(ROLES_KEYS.commands.addMember.label)
              .setIcon('@tui.git-branch')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAddMemberModal()),
          ),
      )
      .setSelectionCount(this.selectionCount)
      .setSelectionScope(this.store.scopeKind)
      .setSelectionLabel(ROLES_KEYS.title)
      .setOnClearSelection(() => {
        this.store.clearSelection();
        this._table()?.clearSelection();
      })
      .setPinnedActionIds(['create-role', 'add-permission', 'add-member']),
  );

  private _openAddPermissionModal(): void {
    this._modalService.open<BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest, ErpBatchMetadata>(
      ROLE_ADD_PERMISSION_MODAL_ID,
      erpBuildBatchTargets(this.store.scope()),
      { targetCount: this.selectionCount() },
    );
  }

  private _openAddMemberModal(): void {
    this._modalService.open<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, ErpBatchMetadata>(
      ROLE_ADD_MEMBER_MODAL_ID,
      erpBuildBatchTargets(this.store.scope()),
      { targetCount: this.selectionCount() },
    );
  }
}
