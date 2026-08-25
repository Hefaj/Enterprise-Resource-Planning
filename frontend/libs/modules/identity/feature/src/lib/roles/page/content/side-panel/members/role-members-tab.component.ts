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
import { ROLE_ADD_MEMBER_MODAL_ID } from '@erp/identity/util';
import { ROLES_KEYS } from '../../../../translation';
import { RoleMemberRow, RoleMembersTabStore } from './role-members-tab.store';

/**
 * Zakładka „Role składowe" — składowe WSZYSTKICH zaznaczonych ról w JEDNEJ tabeli, pogrupowane
 * po roli-kontenerze (patrz `docs/frontend/pages.md` §6).
 */
@Component({
  selector: 'erp-identity-role-members-tab',
  standalone: true,
  imports: [
    CommonModule,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpTableComponent,
    ErpEmptyStateComponent,
  ],
  providers: [RoleMembersTabStore],
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
export class RoleMembersTabComponent {
  private readonly _tabStore = inject(RoleMembersTabStore);
  private readonly _orchestrator = inject(RoleOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly roles = this._tabStore.roles;

  protected readonly rows = computed<RoleMemberRow[]>(() =>
    this.roles().flatMap((role) =>
      (role.members ?? []).map((member) => ({ containerRoleUuid: role.uuid, member, isSystem: role.isSystem })),
    ),
  );

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.RoleManage));

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: ROLES_KEYS.detail.emptySelection,
  };

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('identity-role-members-toolbar')
      .addDefaultGroup((g) =>
        g
          .setId('members')
          .setLabel(ROLES_KEYS.detail.tabs.members)
          .setIcon('@tui.git-branch')
          .addAction((a) =>
            a
              .setId('add-member')
              .setLabel(ROLES_KEYS.commands.addMember.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAddMemberModal()),
          ),
      )
      .addSelectionGroup((g) =>
        g
          .setId('member-selection')
          .setLabel(ROLES_KEYS.detail.members.revokeAction)
          .setIcon('@tui.trash-2')
          .addAction((a) =>
            a
              .setId('remove-member')
              .setLabel(ROLES_KEYS.detail.members.revokeAction)
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
      .setSelectionLabel(ROLES_KEYS.detail.tabs.members)
      .setOnClearSelection(() => this._tabStore.clearChildSelection())
      .setPinnedActionIds(['add-member']),
  );

  protected readonly tableConfig = computed<ErpTableConfig<RoleMemberRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<RoleMemberRow>>((table) =>
      table
        .setStateKey('identity-roles-members-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.containerRoleUuid}:${r.member.uuid}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setSelectionMode(this.canManage() && this._tabStore.canSelectChildren() ? 'multi' : 'none')
        .setOnSelectionChange((state: ErpSelectionState<RoleMemberRow>) =>
          this._tabStore.setSelectedChildren((state.selectedItems ?? []).filter((row) => !row.isSystem)),
        )
        .setEmptyMessage(ROLES_KEYS.detail.members.emptyMessage)
        .addColumn((c) =>
          c
            .setId('code')
            .setAccessorFn((row: RoleMemberRow) => row.member.code)
            .setHeader(ROLES_KEYS.detail.members.columns.code)
            .setSize(200),
        )
        .addColumn((c) =>
          c
            .setId('name')
            .setAccessorFn((row: RoleMemberRow) => row.member.name)
            .setHeader(ROLES_KEYS.detail.members.columns.name)
            .setSize(220),
        )
        .setGroupedRows<RoleVM>((g) =>
          g
            .setGroups(this.roles)
            .setGetGroupKey((r) => r.uuid)
            .setGetRowGroupKey((r: RoleMemberRow) => r.containerRoleUuid)
            .setGetGroupTitle((r) => r.name ?? r.code)
            .setGetGroupSubtitle((r) => r.code)
            .setGetGroupIcon(() => '@tui.git-branch')
            .setDefaultExpanded(true),
        ),
    ),
  );

  /**
   * Modal dodania roli składowej adresuje CAŁY zasięg zaznaczonych ról. `excludeUuids` chroni
   * przed cyklem — wyklucza same zaznaczone role i ich obecne składowe.
   */
  private _openAddMemberModal(): void {
    const targets = this._tabStore.batchTargets();
    const excludeUuids = [
      ...this.roles().map((r) => r.uuid),
      ...this.rows().map((r) => r.member.uuid),
    ];
    this._modalService.open(
      ROLE_ADD_MEMBER_MODAL_ID,
      {
        targetUuids: targets.targetUuids,
        targetFilter: targets.targetFilter,
        targetCount: this._tabStore.scopeCount(),
      },
      { excludeUuids },
    );
  }

  private _onRemoveSelected(): void {
    const pairs = Object.entries(this._tabStore.selectedMembersByContainer()).flatMap(([containerRoleUuid, memberUuids]) =>
      memberUuids.map((memberRoleUuid) => ({ containerRoleUuid, memberRoleUuid })),
    );
    if (pairs.length === 0) return;

    this._confirm
      .confirm(
        ErpConfirmDialogBuilder.create((b) =>
          b
            .setTitle(ROLES_KEYS.detail.members.revokeConfirmTitle)
            .setMessage(ROLES_KEYS.detail.members.revokeConfirmMessage)
            .setConfirmLabel(ROLES_KEYS.detail.members.revokeConfirmYes)
            .setCancelLabel(ROLES_KEYS.detail.members.revokeConfirmNo)
            .setDestructive(),
        ),
      )
      .subscribe((confirmed) => {
        if (!confirmed) return;
        Promise.all(
          pairs.map(({ containerRoleUuid, memberRoleUuid }) =>
            this._orchestrator.removeMemberAsync({ uuid: containerRoleUuid, memberRoleUuid }),
          ),
        )
          .then(() => this._tabStore.clearChildSelection())
          .catch((err) => console.error('[RoleMembersTabComponent] Nie udało się usunąć roli składowej.', err));
      });
  }
}
