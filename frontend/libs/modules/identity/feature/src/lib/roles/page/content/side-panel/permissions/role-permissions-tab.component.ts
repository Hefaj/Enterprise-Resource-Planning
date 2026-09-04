import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpConfirmDialogBuilder,
  ErpConfirmDialogService,
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpModalService,
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { RoleOrchestrator, RoleVM } from '@erp/identity/data-access';
import { ROLE_ADD_PERMISSION_MODAL_ID } from '@erp/identity/util';
import { ROLES_KEYS } from '../../../../translation';
import { RolePermissionRow, RolePermissionsTabStore } from './role-permissions-tab.store';

/**
 * Zakładka „Uprawnienia" — uprawnienia WSZYSTKICH zaznaczonych ról w JEDNEJ tabeli,
 * pogrupowane po roli (patrz `docs/guides/frontend/pages.md` §6).
 *
 * Odbieranie uprawnienia jest akcją zaznaczenia w toolbarze, nie przyciskiem przy chipie —
 * dzięki temu podlega bramkowaniu po uprawnieniach (`docs/guides/frontend/pages.md` §10).
 * Role systemowe są niemodyfikowalne, więc ich wiersze nie wchodzą do akcji.
 */
@Component({
  selector: 'erp-identity-role-permissions-tab',
  standalone: true,
  imports: [
    CommonModule,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpTableComponent,
    ErpEmptyStateComponent,
  ],
  providers: [RolePermissionsTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else {
        <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
          <erp-action-toolbar [config]="actionToolbar" />
          <div class="flex-1 min-h-0">
            <erp-table class="block h-full w-full" [config]="tableConfig()" />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsTabComponent {
  private readonly _tabStore = inject(RolePermissionsTabStore);
  private readonly _orchestrator = inject(RoleOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly roles = this._tabStore.roles;

  protected readonly rows = computed<RolePermissionRow[]>(() =>
    this.roles().flatMap((role) =>
      (role.permissions ?? []).map((code) => ({ roleUuid: role.uuid, code, isSystem: role.isSystem })),
    ),
  );

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.RoleManage));

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: ROLES_KEYS.detail.emptySelection,
  };

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-role-permissions-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('permissions')
          .setLabel(ROLES_KEYS.detail.tabs.permissions)
          .setIcon('@tui.key')
          .addAction((a) =>
            a
              .setId('add-permission')
              .setLabel(ROLES_KEYS.commands.addPermission.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAddModal()),
          ),
      )
      .addSelectionGroup((g) =>
        g
          .setId('permission-selection')
          .setLabel(ROLES_KEYS.detail.permissions.revokeAction)
          .setIcon('@tui.trash-2')
          .addAction((a) =>
            a
              .setId('remove-permission')
              .setLabel(ROLES_KEYS.detail.permissions.revokeAction)
              .setIcon('@tui.trash-2')
              .setAppearance('warning')
              .setScopes(['explicit'])
              .setUnavailableHint(ROLES_KEYS.detail.selectionScope.rowSelectionUnavailable)
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._onRemoveSelected()),
          ),
      )
      .setSelectionCount(this._tabStore.selectedChildrenCount)
      .setSelectionScope(this._tabStore.scopeKind)
      .setSelectionLabel(ROLES_KEYS.detail.tabs.permissions)
      .setOnClearSelection(() => this._tabStore.clearChildSelection())
      .setPinnedActionIds(['add-permission']),
  );

  protected readonly tableConfig = computed<ErpTableConfig<RolePermissionRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<RolePermissionRow>>((table) =>
      table
        .setStateKey('identity-roles-permissions-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.roleUuid}:${r.code}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setSelectionMode(this.canManage() && this._tabStore.canSelectChildren() ? 'multi' : 'none')
        .setOnSelectionChange((state: ErpSelectionState<RolePermissionRow>) =>
          this._tabStore.setSelectedChildren((state.selectedItems ?? []).filter((row) => !row.isSystem)),
        )
        .setEmptyMessage(ROLES_KEYS.detail.permissions.emptyMessage)
        .addColumn((c) =>
          c.setId('code').setAccessorKey('code').setHeader(ROLES_KEYS.detail.permissions.columns.code).setSize(280),
        )
        .setGroupedRows<RoleVM>((g) =>
          g
            .setGroups(this.roles)
            .setGetGroupKey((r) => r.uuid)
            .setGetRowGroupKey((r: RolePermissionRow) => r.roleUuid)
            .setGetGroupTitle((r) => r.name ?? r.code)
            .setGetGroupSubtitle((r) => r.code)
            .setGetGroupIcon(() => '@tui.shield')
            .setDefaultExpanded(true),
        ),
    ),
  );

  /** Modal dodania uprawnienia adresuje CAŁY zasięg zaznaczonych ról. */
  private _openAddModal(): void {
    const targets = this._tabStore.batchTargets();
    this._modalService.open(ROLE_ADD_PERMISSION_MODAL_ID, {
      targetUuids: targets.targetUuids,
      targetFilter: targets.targetFilter,
      targetCount: this._tabStore.scopeCount(),
    });
  }

  private _onRemoveSelected(): void {
    const pairs = Object.entries(this._tabStore.selectedPermissionsByRole()).flatMap(([roleUuid, codes]) =>
      codes.map((permissionCode) => ({ roleUuid, permissionCode })),
    );
    if (pairs.length === 0) return;

    void this._confirm
      .confirmThenAsync(
        ErpConfirmDialogBuilder.create((b) =>
          b
            .setTitle(ROLES_KEYS.detail.permissions.revokeConfirmTitle)
            .setMessage(ROLES_KEYS.detail.permissions.revokeConfirmMessage)
            .setConfirmLabel(ROLES_KEYS.detail.permissions.revokeConfirmYes)
            .setCancelLabel(ROLES_KEYS.detail.permissions.revokeConfirmNo)
            .setDestructive(),
        ),
        async () => {
          await Promise.all(
            pairs.map(({ roleUuid, permissionCode }) =>
              this._orchestrator.removePermissionAsync({ uuid: roleUuid, permissionCode }),
            ),
          );
          this._tabStore.clearChildSelection();
        },
      )
      .catch((err: unknown) => console.error('[RolePermissionsTabComponent] Nie udało się odebrać uprawnienia.', err));
  }
}
