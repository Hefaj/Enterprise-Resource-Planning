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
  ErpSelectionScopeBannerBuilder,
  ErpSelectionScopeBannerComponent,
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { USER_ADD_ROLE_MODAL_ID } from '@erp/identity/util';
import { USERS_KEYS } from '../../../../translation';
import { UserRoleGrantRow, UserRolesTabStore } from './user-roles-tab.store';

/**
 * Zakładka „Role" — role WSZYSTKICH zaznaczonych użytkowników w JEDNEJ tabeli, pogrupowane po
 * użytkowniku (patrz `docs/frontend/pages.md` §6). Panel otwiera wybór zakładki, nie zaznaczenie,
 * więc obsługuje też stan „nic nie zaznaczono" oraz próbkę w trybie `query`.
 *
 * Odbieranie roli jest akcją zaznaczenia w `erp-action-toolbar` (zaznacz wiersze, potem
 * „Odbierz rolę" w toolbarze), nie przyciskiem w komórce tabeli.
 */
@Component({
  selector: 'erp-identity-user-roles-tab',
  standalone: true,
  imports: [
    CommonModule,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpTableComponent,
    ErpEmptyStateComponent,
    ErpSelectionScopeBannerComponent,
  ],
  providers: [UserRolesTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else if (resolving()) {
        <erp-empty-state [config]="resolvingConfig" />
      } @else {
        <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
          <erp-action-toolbar [config]="actionToolbar" />
          <erp-selection-scope-banner [config]="scopeBannerConfig" />
          <div class="flex-1 min-h-0">
            <erp-table class="block h-full w-full" [config]="tableConfig()" />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserRolesTabComponent {
  private readonly _tabStore = inject(UserRolesTabStore);
  private readonly _orchestrator = inject(UserOrchestrator);
  private readonly _modalService = inject(ErpModalService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _permissionStore = inject(PermissionStore);

  protected readonly scopeKind = this._tabStore.scopeKind;
  protected readonly resolving = this._tabStore.resolving;

  /** Użytkownicy renderowani przez panel — komplet zaznaczonych albo próbka z filtra. */
  protected readonly users = this._tabStore.users;

  /** Wszystkie przypisania ról widocznych użytkowników — jedna wspólna, płaska lista wierszy. */
  protected readonly rows = computed<UserRoleGrantRow[]>(() =>
    this.users().flatMap((user) => (user.roleGrants ?? []).map((grant) => ({ userUuid: user.uuid, grant }))),
  );

  protected readonly canManage = computed(() => this._permissionStore.has(ERP_PERMISSIONS.Identity.UserManage));

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: USERS_KEYS.detail.emptySelection,
  };

  protected readonly resolvingConfig: ErpEmptyStateConfig = {
    icon: '@tui.loader',
    message: USERS_KEYS.detail.selectionScope.resolving,
  };

  protected readonly scopeBannerConfig = ErpSelectionScopeBannerBuilder.create((b) =>
    b
      .setScope(this._tabStore.scope)
      .setShownCount(this._tabStore.shownUserCount)
      .setPreviewTitle(USERS_KEYS.detail.selectionScope.previewTitle)
      .setPreviewDescription(USERS_KEYS.detail.selectionScope.previewDescription)
      .setAllTitle(USERS_KEYS.detail.selectionScope.allTitle),
  );

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
              .setLabel(USERS_KEYS.commands.addRole.label)
              .setIcon('@tui.plus')
              .setAppearance('success')
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._openAssignModal()),
          ),
      )
      // Operacje na WSKAZANYCH przypisaniach — wymagają zaznaczenia rozwiązanego do listy
      // użytkowników, bo „odbierz tę rolę" adresuje konkretną parę użytkownik+rola.
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
              .setScopes(['explicit'])
              .setUnavailableHint(USERS_KEYS.detail.selectionScope.rowSelectionUnavailable)
              .setHidden(computed(() => !this.canManage()))
              .setFn(() => this._onRevokeSelected()),
          ),
      )
      .setSelectionCount(this._tabStore.selectedChildrenCount)
      .setSelectionScope(this._tabStore.scopeKind)
      .setSelectionLabel(USERS_KEYS.detail.tabs.roles)
      .setOnClearSelection(() => this._tabStore.clearChildSelection())
      .setPinnedActionIds(['assign-role']),
  );

  /**
   * Konfiguracja jest `computed`, bo tryb zaznaczenia zależy od zasięgu: przy zaznaczeniu
   * opisanym filtrem panel pokazuje tylko próbkę, więc checkboxy wierszy znikają.
   */
  protected readonly tableConfig = computed<ErpTableConfig<UserRoleGrantRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<UserRoleGrantRow>>((table) =>
      table
        .setStateKey('identity-users-roles-tab')
        .setMode('client')
        .setRowIdAccessor((r) => `${r.userUuid}:${r.grant.roleUuid}`)
        .setItems(this.rows)
        .setItemCount(computed(() => this.rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(48)
        .setSelectionMode(this.canManage() && this._tabStore.canSelectChildren() ? 'multi' : 'none')
        .setOnSelectionChange((state: ErpSelectionState<UserRoleGrantRow>) =>
          this._tabStore.setSelectedChildren(state.selectedItems ?? []),
        )
        .setEmptyMessage(USERS_KEYS.detail.roles.emptyMessage)
        .addColumn((c) =>
          c
            .setId('code')
            .setAccessorFn((row: UserRoleGrantRow) => row.grant.role?.code ?? row.grant.roleUuid)
            .setHeader(USERS_KEYS.detail.roles.columns.role)
            .setSize(200),
        )
        .addColumn((c) =>
          c
            .setId('grantedAt')
            .setAccessorFn((row: UserRoleGrantRow) => row.grant.grantedAt)
            .setHeader(USERS_KEYS.detail.roles.columns.grantedAt)
            .setSize(160)
            .setGrow(0)
            .setCellFormatter((value: Date) => (value ? new Date(value).toLocaleDateString() : '—')),
        )
        .addColumn((c) =>
          c
            .setId('expiresAt')
            .setAccessorFn((row: UserRoleGrantRow) => row.grant.expiresAt)
            .setHeader(USERS_KEYS.detail.roles.columns.expiresAt)
            .setSize(160)
            .setGrow(0)
            .setCellFormatter((value: Date | undefined) => (value ? new Date(value).toLocaleDateString() : '—')),
        )
        .setGroupedRows<UserVM>((g) =>
          g
            .setGroups(this.users)
            .setGetGroupKey((u) => u.uuid)
            .setGetRowGroupKey((r: UserRoleGrantRow) => r.userUuid)
            .setGetGroupTitle((u) => u.displayName ?? u.email)
            .setGetGroupSubtitle((u) => u.email)
            .setGetGroupIcon(() => '@tui.user')
            .setDefaultExpanded(true),
        ),
    ),
  );

  /** Modal nadania roli adresuje CAŁY zasięg — nie tylko widoczną próbkę. */
  private _openAssignModal(): void {
    const targets = this._tabStore.batchTargets();
    this._modalService.open(USER_ADD_ROLE_MODAL_ID, {
      targetUuids: targets.targetUuids,
      targetFilter: targets.targetFilter,
      targetCount: this._tabStore.scopeCount(),
    });
  }

  private _onRevokeSelected(): void {
    const pairs = Object.entries(this._tabStore.selectedRolesByUser()).flatMap(([userUuid, roleUuids]) =>
      roleUuids.map((roleUuid) => ({ userUuid, roleUuid })),
    );
    if (pairs.length === 0) return;

    this._confirm
      .confirm(
        ErpConfirmDialogBuilder.create((b) =>
          b
            .setTitle(USERS_KEYS.detail.roles.revokeConfirmTitle)
            .setMessage(USERS_KEYS.detail.roles.revokeConfirmMessage)
            .setConfirmLabel(USERS_KEYS.detail.roles.revokeConfirmYes)
            .setCancelLabel(USERS_KEYS.detail.roles.revokeConfirmNo)
            .setDestructive(),
        ),
      )
      .subscribe((confirmed) => {
        if (!confirmed) return;
        Promise.all(
          pairs.map(({ userUuid, roleUuid }) => this._orchestrator.removeRoleAsync({ uuid: userUuid, roleUuid })),
        )
          .then(() => this._tabStore.clearChildSelection())
          .catch((err) => console.error('[UserRolesTabComponent] Nie udało się odebrać roli.', err));
      });
  }
}
